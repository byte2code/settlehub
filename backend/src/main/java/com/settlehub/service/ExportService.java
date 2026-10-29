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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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

    @Value("${brevo.api.key:${BREVO_API_KEY:}}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:${BREVO_SENDER_EMAIL:}}")
    private String brevoSenderEmail;

    @Value("${resend.api.key:${RESEND_API_KEY:}}")
    private String resendApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

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
     * Prefers HTTP email APIs (Brevo / Resend) over port 443 so cloud environments with blocked SMTP
     * ports (e.g. Render free tier) can send emails cleanly without timeouts.
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

        boolean hasBrevo = brevoApiKey != null && !brevoApiKey.isBlank();
        boolean hasResend = resendApiKey != null && !resendApiKey.isBlank();
        boolean hasSmtp = mailSender != null;

        if (!hasBrevo && !hasResend && !hasSmtp) {
            log.warn("Neither Brevo API, Resend, nor JavaMailSender is configured. Direct Excel download is available.");
            return Map.of(
                    "success", false,
                    "message", "Email service not configured. You can download the Excel sheet directly via the Download button!",
                    "recipients", recipientEmails
            );
        }

        try {
            byte[] excelBytes = generateExcelReport(groupId, currentUserId, timeZone);
            Map<String, Object> waSummary = generateWhatsAppSummary(groupId, currentUserId);
            String summaryText = (String) waSummary.get("summaryText");
            String fileName = group.getName().replaceAll("[^a-zA-Z0-9_-]", "_") + "_Expense_Report.xlsx";

            // Try Brevo first, then Resend, then SMTP — each independently
            String lastError = null;

            if (hasBrevo) {
                boolean sent = sendBrevoEmail(recipientEmails, group.getName(), summaryText, excelBytes, fileName);
                if (sent) {
                    return Map.of(
                            "success", true,
                            "message", "Excel report emailed to " + recipientEmails.size() + " member(s) via Brevo! Check your inbox.",
                            "recipients", recipientEmails
                    );
                }
                lastError = "Brevo rejected the request — check BREVO_API_KEY and that the sender email is verified in Brevo.";
            }

            if (hasResend) {
                boolean sent = sendResendEmail(recipientEmails, group.getName(), summaryText, excelBytes, fileName);
                if (sent) {
                    return Map.of(
                            "success", true,
                            "message", "Excel report emailed to " + recipientEmails.size() + " member(s) via Resend! Check your inbox.",
                            "recipients", recipientEmails
                    );
                }
                lastError = "Resend rejected the request — check RESEND_API_KEY.";
            }

            if (hasSmtp) {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : "noreply@settlehub.com";
                helper.setFrom(from, "SettleHub");
                helper.setTo(recipientEmails.toArray(new String[0]));
                helper.setSubject("SettleHub Expense Report: " + group.getName());

                String htmlBody = buildHtmlReport(group.getName(), summaryText);
                helper.setText(htmlBody, true);
                helper.addAttachment(fileName, new ByteArrayResource(excelBytes));

                mailSender.send(message);

                return Map.of(
                        "success", true,
                        "message", "Excel report successfully emailed to " + recipientEmails.size() + " member(s)!",
                        "recipients", recipientEmails
                );
            }

            // All providers attempted and failed
            String userMsg = lastError != null
                    ? lastError
                    : "Could not send the email right now. Use the Excel download button instead.";
            return Map.of("success", false, "message", userMsg, "recipients", recipientEmails);
        } catch (Exception e) {
            log.error("Failed to email report for group {}: {}", groupId, e.getMessage(), e);
            return Map.of(
                    "success", false,
                    "message", "Error sending email: " + e.getMessage() + ". Use the Excel download instead.",
                    "recipients", recipientEmails
            );
        }
    }

    private String buildHtmlReport(String groupName, String summaryText) {
        return "<html><body style='font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; color: #1e293b;'>"
                + "<div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>"
                + "<h2 style='color: #0f766e;'>📊 SettleHub — " + HtmlUtils.htmlEscape(groupName) + "</h2>"
                + "<p>Attached is the full Excel spreadsheet with all recorded transactions and debt settlements for your trip.</p>"
                + "<div style='background-color: #f8fafc; padding: 15px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; font-size: 13px;'>"
                + HtmlUtils.htmlEscape(summaryText).replace("\n", "<br/>")
                + "</div>"
                + "<p style='margin-top: 20px; font-size: 12px; color: #64748b;'>Sent automatically via SettleHub</p>"
                + "</div></body></html>";
    }

    /**
     * Produces a properly escaped JSON string literal.
     * Uses Jackson ObjectMapper's writeValueAsString so that multi-codepoint characters
     * (emoji, surrogate pairs, supplementary Unicode) are serialised correctly and the
     * resulting payload is always valid JSON — fixing Brevo 400 errors caused by emoji
     * in group names or the subject line.
     */
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON_MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private static String jsonString(String str) {
        if (str == null) return "null";
        try {
            return JSON_MAPPER.writeValueAsString(str);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            // Extremely unlikely — fall back to manual escaping of ASCII-safe chars only
            return "\"" + str.replaceAll("[\"\\\\]", "\\\\$0")
                             .replace("\n", "\\n").replace("\r", "\\r")
                             .replace("\t", "\\t") + "\"";
        }
    }

    private boolean sendBrevoEmail(List<String> recipientEmails, String groupName, String summaryText,
                                   byte[] excelBytes, String fileName) {
        try {
            String senderEmail = (brevoSenderEmail != null && !brevoSenderEmail.isBlank())
                    ? brevoSenderEmail.trim()
                    : (mailFrom != null && !mailFrom.isBlank() ? mailFrom.trim() : "noreply@settlehub.com");

            StringBuilder toArr = new StringBuilder("[");
            for (int i = 0; i < recipientEmails.size(); i++) {
                if (i > 0) toArr.append(",");
                toArr.append("{\"email\":").append(jsonString(recipientEmails.get(i))).append("}");
            }
            toArr.append("]");

            String base64Excel = Base64.getEncoder().encodeToString(excelBytes);

            String jsonBody = "{"
                    + "\"sender\":{\"name\":\"SettleHub\",\"email\":" + jsonString(senderEmail) + "},"
                    + "\"to\":" + toArr + ","
                    + "\"subject\":" + jsonString("📊 SettleHub Expense Report: " + groupName) + ","
                    + "\"htmlContent\":" + jsonString(buildHtmlReport(groupName, summaryText)) + ","
                    + "\"attachment\":[{\"name\":" + jsonString(fileName) + ",\"content\":" + jsonString(base64Excel) + "}]"
                    + "}";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .timeout(Duration.ofSeconds(15))
                    .header("api-key", brevoApiKey.trim())
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Successfully sent Brevo email report for group '{}' to {} recipient(s): HTTP {}",
                        groupName, recipientEmails.size(), response.statusCode());
                return true;
            } else {
                log.error("Brevo API error (HTTP {}): {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to send Brevo HTTP email for group '{}': {}", groupName, e.getMessage(), e);
            return false;
        }
    }

    private boolean sendResendEmail(List<String> recipientEmails, String groupName, String summaryText,
                                    byte[] excelBytes, String fileName) {
        try {
            String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom.trim() : "SettleHub <onboarding@resend.dev>";

            StringBuilder toArr = new StringBuilder("[");
            for (int i = 0; i < recipientEmails.size(); i++) {
                if (i > 0) toArr.append(",");
                toArr.append(jsonString(recipientEmails.get(i)));
            }
            toArr.append("]");

            String base64Excel = Base64.getEncoder().encodeToString(excelBytes);

            String jsonBody = "{"
                    + "\"from\":" + jsonString(from) + ","
                    + "\"to\":" + toArr + ","
                    + "\"subject\":" + jsonString("📊 SettleHub Expense Report: " + groupName) + ","
                    + "\"html\":" + jsonString(buildHtmlReport(groupName, summaryText)) + ","
                    + "\"attachments\":[{\"filename\":" + jsonString(fileName) + ",\"content\":" + jsonString(base64Excel) + "}]"
                    + "}";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + resendApiKey.trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Successfully sent Resend email report for group '{}' to {} recipient(s): HTTP {}",
                        groupName, recipientEmails.size(), response.statusCode());
                return true;
            } else {
                log.error("Resend API error (HTTP {}): {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to send Resend HTTP email for group '{}': {}", groupName, e.getMessage(), e);
            return false;
        }
    }
}
