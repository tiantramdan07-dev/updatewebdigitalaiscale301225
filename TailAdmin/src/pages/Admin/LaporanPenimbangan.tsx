import React, { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ModalNotifikasi, { ModalStatus } from "../../components/modal/ModalNotifikasi";

const API_URL = "http://192.168.10.214:4000";

// ✅ FIX TypeScript autoTable
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}

interface Riwayat {
  id: number;
  nama_produk: string;
  berat: number;
  harga_per_kg: number;
  total_harga: number;
  waktu: string;
}

const LaporanPenimbangan: React.FC = () => {
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [filteredData, setFilteredData] = useState<Riwayat[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<any>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalStatus, setModalStatus] = useState<ModalStatus>(null);

  const [sortOrder, setSortOrder] = useState("");
  const [sortName, setSortName] = useState("");

  const [range, setRange] = useState<any>([
    { startDate: new Date(), endDate: new Date(), key: "selection" },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // fetch data
  const fetchRiwayat = async () => {
    setLoading(true);

    try {
      // Ambil token dari localStorage dulu, kalau tidak ada ambil dari sessionStorage
      let token = localStorage.getItem("token") || sessionStorage.getItem("token");

      // Kalau token tidak ada, redirect login
      if (!token) {
        window.location.href = "/signin";
        return;
      }

      const res = await fetch(`${API_URL}/api/riwayat`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Jika token expired/invalid → hapus token dari dua storage
      if (res.status === 401) {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        window.location.href = "/signin";
        return;
      }

      if (!res.ok) throw new Error("Gagal mengambil data server");

      const data = await res.json();
      setRiwayat(data);
      setFilteredData(data);

      setModalMessage("Berhasil memuat data laporan!");
      setModalStatus("success");
      setModalOpen(true);

    } catch (err) {
      console.error("Gagal memuat riwayat:", err);
      setModalMessage("Gagal memuat laporan. Cek koneksi server!");
      setModalStatus("error");
      setModalOpen(true);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, []);

  const formatTanggal = (waktu: string) => {
    const date = new Date(waktu);
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(date) + " WIB"
    );
  };

  const formatLocalDate = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
  };

  const dateLabel = useMemo(() => {
    const rangeToDisplay = activeRange || range;
    const start = formatLocalDate(rangeToDisplay[0].startDate);
    const end = formatLocalDate(rangeToDisplay[0].endDate);
    return (
      <span className="flex items-center gap-2">
        <img src="assets/kalender.png" alt="kalender" className="w-5 h-5 inline-block" />
        <span className={activeRange ? "text-blue-600 font-medium" : ""}>
          {start} - {end}
        </span>
      </span>
    );
  }, [range, activeRange]);

  const getSortedData = (data: Riwayat[], timeOrder: string, nameOrder: string) => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      if (timeOrder) {
        const dateA = new Date(a.waktu).getTime();
        const dateB = new Date(b.waktu).getTime();
        if (timeOrder === "asc") return dateA - dateB;
        if (timeOrder === "desc") return dateB - dateA;
      }
      if (nameOrder) {
        if (nameOrder === "asc") return a.nama_produk.localeCompare(b.nama_produk);
        if (nameOrder === "desc") return b.nama_produk.localeCompare(a.nama_produk);
      }
      return 0;
    });
    return sorted;
  };

  const handleFilterApply = () => {
    const start = range[0].startDate;
    const end = range[0].endDate;
    let filtered: Riwayat[] = [];
    if (start && end) {
      const adjustedEnd = new Date(end);
      adjustedEnd.setHours(23, 59, 59, 999);
      filtered = riwayat.filter((item) => {
        const date = new Date(item.waktu);
        return date >= start && date <= adjustedEnd;
      });
      setActiveRange(range);
      setModalMessage("Filter tanggal berhasil diterapkan!");
      setModalStatus("success");
      setModalOpen(true);
    } else {
      filtered = [...riwayat];
      setActiveRange(null);
    }
    setFilteredData(getSortedData(filtered, sortOrder, sortName));
    setShowPicker(false);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilteredData(riwayat);
    setSortOrder("");
    setSortName("");
    setSearchTerm("");
    setRange([{ startDate: new Date(), endDate: new Date(), key: "selection" }]);
    setActiveRange(null);
    setModalMessage("Filter berhasil direset!");
    setModalStatus("info");
    setModalOpen(true);
    setCurrentPage(1);
  };

  useEffect(() => {
    const filtered = riwayat.filter((item) =>
      item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredData(getSortedData(filtered, sortOrder, sortName));
    setCurrentPage(1);
  }, [searchTerm, riwayat, sortOrder, sortName]);

  const exportToExcel = () => {
    if (filteredData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((item, index) => ({
        No: index + 1,
        Nama: item.nama_produk,
        Berat: item.berat,
        Harga: item.harga_per_kg,
        Total: item.total_harga,
        Waktu: formatTanggal(item.waktu),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
    XLSX.writeFile(workbook, "Laporan_Penimbangan.xlsx");
  };


// ======================= EXPORT PDF =======================

const exportToPDF = () => {
  if (filteredData.length === 0) return;

  const useLogo = false; // ubah ke true jika ingin pakai logo

  const doc = new jsPDF("p", "mm", "a4");
  const margin = 14;

  if (useLogo) {
    const logo = new Image();
    logo.src = "images/logo/logoim.png";

    logo.onload = () => {
      const logoW = 28;
      const logoH = 28;
      const logoY = 9;
      const logoX = margin + 6;
      doc.addImage(logo, "PNG", logoX, logoY, logoW, logoH);

      generateContent(doc);
    };
  } else {
    generateContent(doc);
  }
};

function generateContent(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageCenter = pageW / 2;
  const margin = 14;
  const logoY = 9;
  const logoH = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PT. INTERSKALA MANDIRI INDONESIA", pageCenter, logoY + 5, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "Green Sedayu Biz Park Jl. Daan Mogot KM.18, DM 12 No.62,",
    pageCenter,
    logoY + 11,
    { align: "center" }
  );
  doc.text(
    "RT.3/RW.8, Kalideres, West Jakarta City, Jakarta 11840",
    pageCenter,
    logoY + 16,
    { align: "center" }
  );
  doc.text(
    "Telp: (021) 5439-0045 | Email: sales@interskala.com",
    pageCenter,
    logoY + 21,
    { align: "center" }
  );

  const lineY = logoY + logoH + 6;
  doc.setLineWidth(0.3);
  doc.line(margin, lineY, pageW - margin, lineY);

  const titleY = lineY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LAPORAN PENIMBANGAN", pageCenter, titleY, { align: "center" });

  const tableRows = filteredData.map((item: any, index: number) => [
    index + 1,
    item.nama_produk,
    item.berat.toFixed(2),
    `Rp ${item.harga_per_kg.toLocaleString("id-ID")}`,
    `Rp ${item.total_harga.toLocaleString("id-ID")}`,
    formatTanggal(item.waktu),
  ]);

  const totalBerat = filteredData.reduce((sum: number, item: any) => sum + item.berat, 0);
  const totalHarga = filteredData.reduce((sum: number, item: any) => sum + item.total_harga, 0);

  autoTable(doc, {
    head: [["No", "Nama Produk", "Berat (Kg)", "Harga/Kg", "Total", "Waktu"]],
    body: tableRows,
    startY: titleY + 7,

    foot: [
      [
        { content: "Total Keseluruhan", colSpan: 2, styles: { halign: "right", fontStyle: "bold" } },
        { content: `${totalBerat.toFixed(2)} Kg`, styles: { halign: "center", fontStyle: "bold" } },
        { content: "" },
        { content: `Rp ${totalHarga.toLocaleString("id-ID")}`, styles: { halign: "center", fontStyle: "bold" } },
        { content: "" }
      ]
    ],

    theme: "grid",

    headStyles: {
      fillColor: [0, 163, 136], // warna header
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },

    footStyles: {
      fillColor: [0, 163, 136], // warna footer
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },

    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: "center",
    },
  });


  const finalY = (doc.lastAutoTable?.finalY ?? 120) + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const leftCenterX = pageW / 2 - 80;
  const rightCenterX = pageW / 2 + 80;

  doc.text("Diperiksa,", leftCenterX, finalY, { align: "center" });
  doc.text("(_______________)", leftCenterX, finalY + 35, { align: "center" });

  doc.text("Mengetahui,", rightCenterX, finalY, { align: "center" });
  doc.text("(_______________)", rightCenterX, finalY + 35, { align: "center" });

  const pageCount = doc.getNumberOfPages();
  const footerY = pageH - 8;
  const timestamp = new Date().toLocaleString("id-ID");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);

    doc.text(`Printed: ${timestamp}`, margin, footerY);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, footerY, { align: "right" });
  }

  doc.save("Laporan_Penimbangan.pdf");
}


  // =====================================================

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
  const displayedData = filteredData.slice(startIndex, endIndex);

  return (
    <div className="p-5 md:p-5 dark:bg-gray-900 dark:text-gray-100 min-h-screen relative">
      <ModalNotifikasi
        isOpen={modalOpen}
        message={modalMessage}
        status={modalStatus}
        onClose={() => setModalOpen(false)}
      />

      <div className="flex items-center gap-2 mb-5">
        <img src="assets/laporan.png" alt="Laporan" className="w-10 h-10 md:w-10 md:h-10" />
        <h2 className="text-xl md:text-xl font-bold">Laporan Penimbangan</h2>
      </div>

      {/* SEARCH + FILTER */}
      <div
        className="
          flex flex-col sm:flex-row flex-wrap
          items-start sm:items-center gap-3 mb-6
          bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md relative
        "
      >
        <div className="w-full sm:w-64">
        <input
          id="searchProduct"
          name="searchProduct"
          type="text"
          placeholder="Cari nama produk..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border rounded-xl px-3 py-2 text-sm"
        />
        </div>

        <div className="w-full sm:w-auto">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 border rounded-xl px-3 py-2 w-full sm:w-auto justify-center"
            aria-expanded={showPicker}
          >
            {dateLabel}
          </button>

          {showPicker && (
            <div className="absolute top-28 sm:top-16 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 border border-gray-200 dark:border-gray-700">
              <DateRange
                editableDateInputs
                onChange={(item) => setRange([item.selection])}
                ranges={range}
                rangeColors={["#3b82f6"]}
                direction="horizontal"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    handleFilterApply();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm"
                >
                  Terapkan
                </button>
                <button
                  onClick={() => setShowPicker(false)}
                  className="border rounded-md px-3 py-1.5 text-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap gap-2 ml-0 sm:ml-auto">
          <button
            onClick={handleReset}
            className="
              flex items-center gap-2
              border border-red-500 text-red-500
              hover:bg-red-50 dark:hover:bg-gray-700
              rounded-lg px-2.5 py-1.5 text-sm
              w-auto flex-shrink-0
            "
          >
            <img src="assets/reset1.png" alt="Reset" className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden sm:inline ml-1">Reset</span>
          </button>

          <button
            onClick={exportToExcel}
            className="
              flex items-center gap-2
              border border-green-600 text-green-600
              hover:bg-green-50 dark:hover:bg-gray-700
              rounded-lg px-2.5 py-1.5 text-sm
              w-auto flex-shrink-0
            "
          >
            <img src="assets/excel.png" alt="Excel" className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden sm:inline ml-1">Excel</span>
          </button>

          <button
            onClick={exportToPDF}
            className="
              flex items-center gap-2
              border border-red-600 text-red-600
              hover:bg-red-50 dark:hover:bg-gray-700
              rounded-lg px-2.5 py-1.5 text-sm
              w-auto flex-shrink-0
            "
          >
            <img src="assets/pdf.png" alt="PDF" className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden sm:inline ml-1">PDF</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="text-center py-6 text-gray-500">Memuat data...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-300 dark:bg-gray-800bg-gray-200 dark:bg-gray-800 uppercase text-sm font-semibold">
              <tr>
                <th className="py-3 px-4 text-center">No</th>
                <th className="py-3 px-4 text-left">Nama Produk</th>
                <th className="py-3 px-4 text-center">Berat (Kg)</th>
                <th className="py-3 px-4 text-center">Harga (/Kg)</th>
                <th className="py-3 px-4 text-center">Total</th>
                <th className="py-3 px-4 text-center">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.length > 0 ? (
                displayedData.map((r, index) => (
                  <tr key={r.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="py-2 px-4 text-center">{startIndex + index + 1}</td>
                    <td className="py-2 px-4 text-left">{r.nama_produk}</td>
                    <td className="py-2 px-4 text-center">{r.berat.toFixed(2)}</td>
                    <td className="py-2 px-4 text-center">{r.harga_per_kg}</td>
                    <td className="py-2 px-4 text-center text-blue-600 font-semibold">
                      Rp {r.total_harga.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2 px-4 text-center">{formatTanggal(r.waktu)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-gray-500">
                    Tidak ada data laporan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION */}
<div
  className="
    w-full
    flex flex-col md:flex-row
    md:items-center justify-between
    mt-4 pt-4 pb-8
    text-xs md:text-sm gap-3
  "
>
  <span className="text-center md:text-left text-gray-700 dark:text-gray-300 whitespace-normal">
    Showing {displayedData.length === 0 ? 0 : startIndex + 1} to{" "}
    {endIndex} of {filteredData.length} rows
  </span>

  <div className="flex items-center gap-6 mx-auto md:mx-0">

    {/* Rows Per Page */}
    <div className="flex items-center gap-3">
      <span className="hidden md:inline text-gray-500 dark:text-gray-400 font-medium">
        Rows per page:
      </span>

      <select
        id="rowsPerPage"
        name="rowsPerPage"
        value={rowsPerPage}
        onChange={(e) => {
          setRowsPerPage(Number(e.target.value));
          setCurrentPage(1);
        }}
        className="
          border dark:border-gray-700 rounded-lg
          pl-5 pr-8 py-2
          bg-white dark:bg-gray-800
          text-gray-800 dark:text-gray-200
          focus:ring-2 focus:ring-blue-500 transition
        "
      >
        {[10, 25, 50, 75, 100].map((num) => (
          <option key={num} value={num}>{num}</option>
        ))}
      </select>
    </div>

    {/* ✅ Pagination */}
    <div className="flex items-center gap-1 flex-wrap justify-center">

      {/* Prev */}
      <button
        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
        disabled={currentPage === 1}
        className="
          px-3 py-1 border rounded-lg
          disabled:opacity-40 dark:border-gray-700
          hover:bg-gray-200 dark:hover:bg-gray-700 transition
        "
      >
        ‹
      </button>

      {/* Page 1 */}
      <button
        onClick={() => setCurrentPage(1)}
        className={`
          px-3 py-1 rounded-lg transition
          ${
            currentPage === 1
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          }
        `}
      >
        1
      </button>

      {/* Left ... */}
      {currentPage > 3 && <span className="px-2">...</span>}

      {/* Middle */}
      {[currentPage - 1, currentPage, currentPage + 1]
        .filter((page) => page > 1 && page < totalPages)
        .map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`
              px-3 py-1 rounded-lg transition
              ${
                currentPage === page
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              }
            `}
          >
            {page}
          </button>
        ))}

      {/* Right ... */}
      {currentPage < totalPages - 2 && <span className="px-2">...</span>}

      {/* Last page */}
      {totalPages > 1 && (
        <button
          onClick={() => setCurrentPage(totalPages)}
          className={`
            px-3 py-1 rounded-lg transition
            ${
              currentPage === totalPages
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            }
          `}
        >
          {totalPages}
        </button>
      )}

      {/* Next */}
      <button
        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="
          px-3 py-1 border rounded-lg
          disabled:opacity-40 dark:border-gray-700
          hover:bg-gray-200 dark:hover:bg-gray-700 transition
        "
      >
        ›
      </button>

    </div>
  </div>
</div>
    </div>
  );
};

export default LaporanPenimbangan;
