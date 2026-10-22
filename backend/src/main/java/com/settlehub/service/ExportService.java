package com.settlehub.service;

import com.settlehub.dto.DebtRepaymentDto;
import com.settlehub.dto.GroupBalanceSummaryDto;
import com.settlehub.model.*;
import com.settlehub.repository.*;
import com.settlehub.util.CurrencyUtil;
import jakarta.mail.internet.MimeMessage;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExportService {

    private static final Logger log = LoggerFactory.getLogger(ExportService.class);
    private static final DateTimeFormatter DATE_PATTERN = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final BalanceService balanceService;
    private final GroupAccessService access;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    public ExportService(ExpenseRepository expenseRepository,
                         SettlementRepository settlementRepository,
                         GroupMemberRepository groupMemberRepository,
                         BalanceService balanceService,
                         GroupAccessService access) {
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.balanceService = balanceService;
        this.access = access;
    }

    static ZoneId zoneOrUtc(String timeZone) {
        try {
            return timeZone == null || timeZone.isBlank() ? ZoneId.of("UTC") : ZoneId.of(timeZone);
        } catch (Exception e) {
            return ZoneId.of("UTC");
        }
    }

    /**
     * Generates a formatted text summary ideal for sharing on WhatsApp or SMS.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> generateWhatsAppSummary(UUID groupId, UUID currentUserId) {
        Group group = access.requireGroup(groupId, currentUserId);

        GroupBalanceSummaryDto balanceSummary = balanceService.getGroupBalanceSummary(groupId, currentUserId);
        List<Expense> expenses = expenseRepository.findActiveByGroupId(groupId);
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(groupId);

        long totalSpendCents = expenses.stream()
                .filter(e -> !e.isPayment())
                .mapToLong(Expense::getCostCents)
                .sum();

        String currency = group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;
        String totalFormatted = CurrencyUtil.formatCents(totalSpendCents, currency);

        StringBuilder sb = new StringBuilder();
        sb.append("📊 *SettleHub — ").append(group.getName()).append("*\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━\n");
        sb.append("💰 *Total Spending:* ").append(totalFormatted).append("\n");
        sb.append("👥 *Members (").append(members.size()).append("):* ")
                .append(members.stream().map(m -> m.getUser().getFirstName()).collect(Collectors.joining(", ")))
                .append("\n\n");

        sb.append("*👤 Member Balances:*\n");
        for (GroupMember member : members) {
            long net = balanceSummary.netBalances().getOrDefault(member.getUser().getId(), 0L);
            String netStr = CurrencyUtil.formatCents(net, currency);
            if (net > 0) {
                sb.append(" • ").append(member.getUser().getFullName()).append(": *+").append(netStr).append("* (gets back)\n");
            } else if (net < 0) {
                sb.append(" • ").append(member.getUser().getFullName()).append(": *").append(netStr).append("* (owes)\n");
            } else {
                sb.append(" • ").append(member.getUser().getFullName()).append(": settled up\n");
            }
        }
        sb.append("\n");

        List<DebtRepaymentDto> debts = balanceSummary.simplifiedDebts();
        if (debts.isEmpty()) {
            sb.append("✅ *All settled up!* No outstanding repayments.\n");
        } else {
            sb.append("*🤝 Who Pays Whom (Minimized Settlements):*\n");
            for (DebtRepaymentDto debt : debts) {
                sb.append(" • *").append(debt.fromUserName()).append("* ➡️ *").append(debt.toUserName()).append("*: ")
                        .append(debt.amountFormatted()).append("\n");
            }
        }

        if (!expenses.isEmpty()) {
            sb.append("\n*📝 Recent Transactions:*\n");
            int count = 0;
            for (Expense exp : expenses) {
                if (count++ >= 5) break;
                sb.append(" • ").append(exp.getDescription()).append(" (")
                        .append(CurrencyUtil.formatCents(exp.getCostCents(), currency)).append(")");
                if (!exp.getPayers().isEmpty()) {
                    sb.append(" - paid by ").append(exp.getPayers().stream()
                            .map(p -> p.getUser().getFirstName()).collect(Collectors.joining(", ")));
                }
                sb.append("\n");
            }
        }

        sb.append("━━━━━━━━━━━━━━━━━━━━\n");
        if (group.getInviteCode() != null && !group.getInviteCode().isBlank()) {
            sb.append("🔗 Join code: *").append(group.getInviteCode()).append("*\n");
        }
        sb.append("✨ _Tracked with SettleHub_");

        String formattedText = sb.toString();

        return Map.of(
                "groupId", groupId.toString(),
                "groupName", group.getName(),
                "currency", currency,
                "totalSpendFormatted", totalFormatted,
                "summaryText", formattedText,
                "debtsCount", debts.size()
        );
    }

    /**
     * Generates a multi-sheet Excel (.xlsx) report containing all transactions,
     * balance summaries, and settlement history.
     */
    @Transactional(readOnly = true)
    public byte[] generateExcelReport(UUID groupId, UUID currentUserId, String timeZone) throws IOException {
        Group group = access.requireGroup(groupId, currentUserId);
        DateTimeFormatter DATE_FORMATTER = DATE_PATTERN.withZone(zoneOrUtc(timeZone));

        List<Expense> expenses = expenseRepository.findActiveByGroupId(groupId);
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(groupId);
        List<Settlement> settlements = settlementRepository.findByGroupId(groupId);
        GroupBalanceSummaryDto balanceSummary = balanceService.getGroupBalanceSummary(groupId, currentUserId);
        String currency = group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Cell Styles
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.TEAL.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.LEFT);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);

            CellStyle boldStyle = workbook.createCellStyle();
            Font boldFont = workbook.createFont();
            boldFont.setBold(true);
            boldStyle.setFont(boldFont);

            // ==========================================
            // SHEET 1: TRANSACTIONS
            // ==========================================
            Sheet sheet1 = workbook.createSheet("Transactions");
            int rowIdx1 = 0;

            Row titleRow = sheet1.createRow(rowIdx1++);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("SettleHub — " + group.getName() + " (Transactions)");
            titleCell.setCellStyle(titleStyle);
            rowIdx1++; // Blank row

            Row headerRow1 = sheet1.createRow(rowIdx1++);
            String[] headers1 = {"#", "Date", "Description", "Category", "Currency", "Total Amount", "Paid By", "Splits Breakdown", "Notes"};
            for (int i = 0; i < headers1.length; i++) {
                Cell c = headerRow1.createCell(i);
                c.setCellValue(headers1[i]);
                c.setCellStyle(headerStyle);
            }

            int itemIndex = 1;
            long grandTotalCents = 0;
            for (Expense exp : expenses) {
                Row row = sheet1.createRow(rowIdx1++);
                row.createCell(0).setCellValue(itemIndex++);
                row.createCell(1).setCellValue(exp.getDate() != null ? DATE_FORMATTER.format(exp.getDate()) : "");
                row.createCell(2).setCellValue(exp.getDescription());
                row.createCell(3).setCellValue(exp.getCategory());
                row.createCell(4).setCellValue(exp.getCurrencyCode() != null ? exp.getCurrencyCode() : currency);
                row.createCell(5).setCellValue(exp.getCostCents() / 100.0);

                String payersStr = exp.getPayers().stream()
                        .map(p -> p.getUser().getFullName() + " (" + CurrencyUtil.formatCents(p.getPaidCents(), currency) + ")")
                        .collect(Collectors.joining(", "));
                row.createCell(6).setCellValue(payersStr);

                String splitsStr = exp.getSplits().stream()
                        .map(s -> s.getUser().getFullName() + " (" + CurrencyUtil.formatCents(s.getOwedCents(), currency) + ")")
                        .collect(Collectors.joining(", "));
                row.createCell(7).setCellValue(splitsStr);
                row.createCell(8).setCellValue(exp.getNotes() != null ? exp.getNotes() : "");

                grandTotalCents += exp.getCostCents();
            }

            Row totalRow = sheet1.createRow(rowIdx1++);
            Cell totalLabel = totalRow.createCell(4);
            totalLabel.setCellValue("Total Spending:");
            totalLabel.setCellStyle(boldStyle);
            Cell totalVal = totalRow.createCell(5);
            totalVal.setCellValue(grandTotalCents / 100.0);
            totalVal.setCellStyle(boldStyle);

            for (int i = 0; i < headers1.length; i++) {
                sheet1.autoSizeColumn(i);
            }

            // ==========================================
            // SHEET 2: SETTLEMENT SUMMARY
            // ==========================================
            Sheet sheet2 = workbook.createSheet("Settlement Summary");
            int rowIdx2 = 0;

            Row s2Title = sheet2.createRow(rowIdx2++);
            Cell s2TitleCell = s2Title.createCell(0);
            s2TitleCell.setCellValue("SettleHub — Balances & Debt Minimization");
            s2TitleCell.setCellStyle(titleStyle);
            rowIdx2++;

            // Members Table
            Row mHeader = sheet2.createRow(rowIdx2++);
            String[] mCols = {"Member Name", "Email", "Role", "Net Balance (" + currency + ")", "Status"};
            for (int i = 0; i < mCols.length; i++) {
                Cell c = mHeader.createCell(i);
                c.setCellValue(mCols[i]);
                c.setCellStyle(headerStyle);
            }

            for (GroupMember m : members) {
                Row r = sheet2.createRow(rowIdx2++);
                r.createCell(0).setCellValue(m.getUser().getFullName());
                r.createCell(1).setCellValue(m.getUser().getEmail());
                r.createCell(2).setCellValue(m.getRole());
                long net = balanceSummary.netBalances().getOrDefault(m.getUser().getId(), 0L);
                r.createCell(3).setCellValue(net / 100.0);
                r.createCell(4).setCellValue(net > 0 ? "Gets Back" : (net < 0 ? "Owes" : "Settled"));
            }

            rowIdx2 += 2; // Spacing

            // Who Owes Whom Table
            Row dHeader = sheet2.createRow(rowIdx2++);
            String[] dCols = {"Payer (Owes)", "Payee (Gets Paid)", "Repayment Amount (" + currency + ")"};
            for (int i = 0; i < dCols.length; i++) {
                Cell c = dHeader.createCell(i);
                c.setCellValue(dCols[i]);
                c.setCellStyle(headerStyle);
            }

            for (DebtRepaymentDto debt : balanceSummary.simplifiedDebts()) {
                Row r = sheet2.createRow(rowIdx2++);
                r.createCell(0).setCellValue(debt.fromUserName());
                r.createCell(1).setCellValue(debt.toUserName());
                r.createCell(2).setCellValue(debt.amountCents() / 100.0);
            }

            for (int i = 0; i < 5; i++) {
                sheet2.autoSizeColumn(i);
            }

            // ==========================================
            // SHEET 3: SETTLEMENT HISTORY
            // ==========================================
            Sheet sheet3 = workbook.createSheet("Settlement History");
            int rowIdx3 = 0;

            Row s3Title = sheet3.createRow(rowIdx3++);
            Cell s3TitleCell = s3Title.createCell(0);
            s3TitleCell.setCellValue("Recorded Settlements & Payments");
            s3TitleCell.setCellStyle(titleStyle);
            rowIdx3++;

            Row sHeader = sheet3.createRow(rowIdx3++);
            String[] sCols = {"Date", "Paid By", "Received By", "Amount Paid", "Currency"};
            for (int i = 0; i < sCols.length; i++) {
                Cell c = sHeader.createCell(i);
                c.setCellValue(sCols[i]);
                c.setCellStyle(headerStyle);
            }

            for (Settlement s : settlements) {
                Row r = sheet3.createRow(rowIdx3++);
                r.createCell(0).setCellValue(s.getDate() != null ? DATE_FORMATTER.format(s.getDate()) : "");
                r.createCell(1).setCellValue(s.getPayer().getFullName());
                r.createCell(2).setCellValue(s.getPayee().getFullName());
                r.createCell(3).setCellValue(s.getAmountCents() / 100.0);
                r.createCell(4).setCellValue(s.getCurrencyCode() != null ? s.getCurrencyCode() : currency);
            }

            for (int i = 0; i < sCols.length; i++) {
                sheet3.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Sends the Excel report and summary via email to all group members.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> emailGroupReport(UUID groupId, UUID currentUserId, String timeZone) {
        Group group = access.requireGroup(groupId, currentUserId);

        List<GroupMember> members = groupMemberRepository.findAllByGroupId(groupId);
        List<String> recipientEmails = members.stream()
                .map(m -> m.getUser().getEmail())
                .filter(email -> email != null && email.contains("@"))
                .distinct()
                .toList();

        if (recipientEmails.isEmpty()) {
            throw new IllegalStateException("No valid member email addresses found for this group.");
        }

        if (mailSender == null) {
            log.warn("JavaMailSender is not configured. Direct Excel download is available.");
            return Map.of(
                    "success", false,
                    "message", "Email SMTP not configured. You can download the Excel sheet directly via the Download button!",
                    "recipients", recipientEmails
            );
        }

        try {
            byte[] excelBytes = generateExcelReport(groupId, currentUserId, timeZone);
            Map<String, Object> waSummary = generateWhatsAppSummary(groupId, currentUserId);
            String summaryText = (String) waSummary.get("summaryText");

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : "noreply@settlehub.com";
            helper.setFrom(from, "SettleHub");
            helper.setTo(recipientEmails.toArray(new String[0]));
            helper.setSubject("📊 SettleHub Expense Report: " + group.getName());

            String htmlBody = "<html><body style='font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>"
                    + "<h2 style='color: #0f766e;'>📊 SettleHub — " + HtmlUtils.htmlEscape(group.getName()) + "</h2>"
                    + "<p>Attached is the full Excel spreadsheet with all recorded transactions and debt settlements for your trip.</p>"
                    + "<div style='background-color: #f8fafc; padding: 15px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; font-size: 13px;'>"
                    + HtmlUtils.htmlEscape(summaryText).replace("\n", "<br/>")
                    + "</div>"
                    + "<p style='margin-top: 20px; font-size: 12px; color: #64748b;'>Sent automatically via SettleHub</p>"
                    + "</div></body></html>";

            helper.setText(htmlBody, true);
            helper.addAttachment(group.getName().replaceAll("[^a-zA-Z0-9_-]", "_") + "_Expense_Report.xlsx",
                    new ByteArrayResource(excelBytes));

            mailSender.send(message);

            return Map.of(
                    "success", true,
                    "message", "Excel report successfully emailed to " + recipientEmails.size() + " member(s)!",
                    "recipients", recipientEmails
            );
        } catch (Exception e) {
            log.error("Failed to email report for group {}: {}", groupId, e.getMessage(), e);
            return Map.of(
                    "success", false,
                    "message", "Could not send the email right now. You can use direct Excel download instead!",
                    "recipients", recipientEmails
            );
        }
    }
}
