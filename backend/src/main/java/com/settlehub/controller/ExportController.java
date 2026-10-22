package com.settlehub.controller;

import com.settlehub.security.UserPrincipal;
import com.settlehub.service.ExportService;
import org.springframework.http.ContentDisposition;
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
public class ExportController {

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/whatsapp")
    public Map<String, Object> getWhatsAppSummary(@PathVariable("groupId") UUID groupId,
                                                  @AuthenticationPrincipal UserPrincipal principal) {
        return exportService.generateWhatsAppSummary(groupId, principal.getId());
    }

    @GetMapping("/excel")
    public ResponseEntity<byte[]> downloadExcelReport(@PathVariable("groupId") UUID groupId,
                                                      @RequestParam(value = "tz", required = false) String timeZone,
                                                      @AuthenticationPrincipal UserPrincipal principal) throws IOException {
        byte[] excelBytes = exportService.generateExcelReport(groupId, principal.getId(), timeZone);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename("settlehub-report.xlsx").build().toString())
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .contentLength(excelBytes.length)
            .body(excelBytes);
    }

    @PostMapping("/email")
    public Map<String, Object> emailGroupReport(@PathVariable("groupId") UUID groupId,
                                                @RequestParam(value = "tz", required = false) String timeZone,
                                                @AuthenticationPrincipal UserPrincipal principal) {
        return exportService.emailGroupReport(groupId, principal.getId(), timeZone);
    }
}
