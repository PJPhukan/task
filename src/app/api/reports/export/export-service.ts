import "server-only";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export async function exportToExcel(
  reportTitle: string,
  reportData: any,
  reportType: string,
  dateRange: { from?: string; to?: string }
): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summarySheet = [
    ["Report", reportTitle],
    ["Generated", new Date().toISOString()],
    ["Date Range", `${dateRange.from || "All"} to ${dateRange.to || "All"}`],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summarySheet), "Summary");

  if (reportType === "me" || reportType === "user") {
    const assignedSheet = [
      ["Metric", "Count"],
      ["Open", reportData.assigned.open],
      ["Overdue", reportData.assigned.overdue],
      ["Completed", reportData.assigned.completed],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(assignedSheet), "Assigned");

    const completedSheet = [
      ["Status", "Count"],
      ...reportData.completedTasks.map((t: any) => [t.label, t.value]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(completedSheet), "Completed");

    if (reportData.completedPerWeek && reportData.completedPerWeek.length > 0) {
      const weekSheet = [
        ["Week", "Count"],
        ...reportData.completedPerWeek.map((w: any) => [w.label, w.value]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(weekSheet), "Per Week");
    }
  } else if (reportType === "overview") {
    const tasksSheet = [
      ["Column", "Count"],
      ...reportData.tasksPerColumn.map((t: any) => [t.label, t.value]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(tasksSheet), "Tasks Per Column");

    const statusSheet = [
      ["Status", "Count"],
      ...reportData.onTimeVsLate.map((t: any) => [t.label, t.value]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(statusSheet), "On Time vs Late");

    if (reportData.overdueList && reportData.overdueList.length > 0) {
      const overdueSheet = [
        ["Task", "Title", "Assignee", "Days Overdue"],
        ...reportData.overdueList.map((t: any) => [t.taskKey, t.taskTitle, t.assignee || "Unassigned", t.daysOverdue]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overdueSheet), "Overdue");
    }

    if (reportData.completedPerWeek && reportData.completedPerWeek.length > 0) {
      const weekSheet = [
        ["Week", "Count"],
        ...reportData.completedPerWeek.map((w: any) => [w.label, w.value]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(weekSheet), "Completed Per Week");
    }

    if (reportData.workloadPerPerson && reportData.workloadPerPerson.length > 0) {
      const workloadSheet = [
        ["Person", "Open", "Overdue", "Completed"],
        ...reportData.workloadPerPerson.map((w: any) => {
          const series = w.series.reduce((acc: any, s: any) => {
            acc[s.label] = s.value;
            return acc;
          }, {});
          return [w.label, series["Open"] || 0, series["Overdue"] || 0, series["Completed"] || 0];
        }),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(workloadSheet), "Workload");
    }
  } else if (reportType === "stage-times") {
    const avgSheet = [
      ["Column", "Average Hours"],
      ...reportData.averageTimePerColumn.map((t: any) => [t.label, t.value]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(avgSheet), "Average Times");

    const longestSheet = [
      ["Column", "Longest Hours"],
      ...reportData.longestTimePerColumn.map((t: any) => [t.label, t.value]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(longestSheet), "Longest Times");

    if (reportData.averageTimePerPersonPerColumn && reportData.averageTimePerPersonPerColumn.length > 0) {
      const columns = reportData.averageTimePerPersonPerColumn[0]?.series?.map((s: any) => s.label) || [];
      const personSheet = [
        ["Person", ...columns],
        ...reportData.averageTimePerPersonPerColumn.map((p: any) => {
          const row = [p.label];
          columns.forEach((col: string) => {
            const val = p.series.find((s: any) => s.label === col);
            row.push(val?.value || 0);
          });
          return row;
        }),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(personSheet), "Per Person Per Column");
    }
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function exportToPdf(
  reportTitle: string,
  reportData: any,
  reportType: string,
  dateRange: { from?: string; to?: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(reportTitle, { align: "center" });
    doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    doc.text(`Date Range: ${dateRange.from || "All"} to ${dateRange.to || "All"}`, { align: "center" });
    doc.moveDown();

    if (reportType === "me" || reportType === "user") {
      doc.fontSize(14).text("Assigned Tasks", { underline: true });
      const assignedData = [
        ["Metric", "Count"],
        ["Open", reportData.assigned.open.toString()],
        ["Overdue", reportData.assigned.overdue.toString()],
        ["Completed", reportData.assigned.completed.toString()],
      ];
      drawTable(doc, assignedData);

      doc.moveDown();
      doc.fontSize(14).text("Completed Tasks", { underline: true });
      const completedData = [
        ["Status", "Count"],
        ...reportData.completedTasks.map((t: any) => [t.label, t.value.toString()]),
      ];
      drawTable(doc, completedData);
    } else if (reportType === "overview") {
      doc.fontSize(14).text("Tasks Per Column", { underline: true });
      const tasksData = [
        ["Column", "Count"],
        ...reportData.tasksPerColumn.map((t: any) => [t.label, t.value.toString()]),
      ];
      drawTable(doc, tasksData);

      doc.moveDown();
      doc.fontSize(14).text("On Time vs Late", { underline: true });
      const statusData = [
        ["Status", "Count"],
        ...reportData.onTimeVsLate.map((t: any) => [t.label, t.value.toString()]),
      ];
      drawTable(doc, statusData);

      if (reportData.overdueList && reportData.overdueList.length > 0) {
        doc.moveDown();
        doc.fontSize(14).text("Overdue Tasks", { underline: true });
        const overdueData = [
          ["Task", "Title", "Assignee", "Days Overdue"],
          ...reportData.overdueList.map((t: any) => [
            t.taskKey,
            t.taskTitle.substring(0, 20),
            t.assignee || "Unassigned",
            t.daysOverdue.toString(),
          ]),
        ];
        drawTable(doc, overdueData);
      }
    } else if (reportType === "stage-times") {
      doc.fontSize(14).text("Average Times Per Column", { underline: true });
      const avgData = [
        ["Column", "Hours"],
        ...reportData.averageTimePerColumn.map((t: any) => [t.label, t.value.toString()]),
      ];
      drawTable(doc, avgData);

      doc.moveDown();
      doc.fontSize(14).text("Longest Times Per Column", { underline: true });
      const longestData = [
        ["Column", "Hours"],
        ...reportData.longestTimePerColumn.map((t: any) => [t.label, t.value.toString()]),
      ];
      drawTable(doc, longestData);
    }

    doc.end();
  });
}

function drawTable(doc: any, data: string[][]): void {
  const rows = data;
  const colCount = rows[0].length;
  const pageWidth = doc.page.width;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  const colWidth = tableWidth / colCount;
  const rowHeight = 20;

  let y = doc.y;

  rows.forEach((row, rowIdx) => {
    const isHeader = rowIdx === 0;
    if (isHeader) {
      doc.fillColor("#e0e0e0");
    }

    row.forEach((cell, colIdx) => {
      const x = margin + colIdx * colWidth;
      doc.rect(x, y, colWidth, rowHeight).stroke();
      doc.fillColor(isHeader ? "#000000" : "#333333");
      doc.fontSize(isHeader ? 11 : 10);
      doc.text(cell, x + 5, y + 2, {
        width: colWidth - 10,
        height: rowHeight - 4,
        align: "left",
        valign: "center",
      });
    });

    y += rowHeight;
  });

  doc.y = y + 10;
}
