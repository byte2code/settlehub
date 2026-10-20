package com.settlehub.controller;

import com.settlehub.security.UserPrincipal;
import com.settlehub.service.ExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/groups/{groupId}/export")
@CrossOrigin(originPatterns = "*", allowedHeaders = "*")
public class ExportController {

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/whatsapp")
    public ResponseEntity<Map<String, Object>> getWhatsAppSummary(
            @PathVariable("groupId") UUID groupId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> summary = exportService.generateWhatsAppSummary(groupId);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/excel")
    public ResponseEntity<byte[]> downloadExcelReport(
            @PathVariable("groupId") UUID groupId,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws IOException {
        byte[] excelBytes = exportService.generateExcelReport(groupId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"settlehub-group-" + groupId + "-report.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(excelBytes.length)
                .body(excelBytes);
    }

    @PostMapping("/email")
    public ResponseEntity<Map<String, Object>> emailGroupReport(
            @PathVariable("groupId") UUID groupId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> result = exportService.emailGroupReport(groupId);
        return ResponseEntity.ok(result);
    }
}
