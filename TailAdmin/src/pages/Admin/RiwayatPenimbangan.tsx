import React, { useEffect, useState, useMemo } from "react";
import { DateRange } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import ModalNotifikasi, { ModalStatus } from "../../components/modal/ModalNotifikasi";

const API_URL = "http://192.168.10.214:4000";

interface Riwayat {
  id: number;
  nama_produk: string;
  berat: number;
  harga_per_kg: number;
  total_harga: number;
  waktu: string;
}

const getDefaultDateRange = () => [
  {
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  },
];

const RiwayatPenimbangan: React.FC = () => {
  const [masterRiwayat, setMasterRiwayat] = useState<Riwayat[]>([]);
  const [displayedRiwayat, setDisplayedRiwayat] = useState<Riwayat[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<any>(getDefaultDateRange());
  const [showPicker, setShowPicker] = useState(false);

  const [sortOrder, setSortOrder] = useState("");
  const [sortName, setSortName] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeRange, setActiveRange] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalStatus, setModalStatus] = useState<ModalStatus>(null);

  const showNotification = (message: string, status: ModalStatus) => {
    setModalMessage(message);
    setModalStatus(status);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    fetchRiwayat();
  }, []);

  const fetchRiwayat = async () => {
    setLoading(true);

    // Ambil token dari dua sumber
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    // Jika dua-duanya tidak ada → redirect login
    if (!token) {
      window.location.href = "/signin";
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/riwayat`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Jika token expired atau invalid → hapus dari dua storage
      if (res.status === 401) {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        window.location.href = "/signin";
        return;
      }

      if (!res.ok) throw new Error("Gagal mengambil riwayat");

      const data = await res.json();
      setMasterRiwayat(data);
      setDisplayedRiwayat(data);

      showNotification("Berhasil memuat riwayat!", "success");
    } catch (err) {
      console.error("❌ Error:", err);
      showNotification("Gagal memuat riwayat. Cek koneksi server!", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let processed = [...masterRiwayat];

    if (activeRange) {
      const start = activeRange[0].startDate;
      const end = activeRange[0].endDate;
      const endAdj = new Date(end);
      endAdj.setHours(23, 59, 59);

      processed = processed.filter((r) => {
        const d = new Date(r.waktu);
        return d >= start && d <= endAdj;
      });
    }

    if (searchTerm.trim() !== "") {
      processed = processed.filter((r) =>
        r.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    processed.sort((a, b) => {
      if (sortOrder) {
        const da = new Date(a.waktu).getTime();
        const db = new Date(b.waktu).getTime();
        if (sortOrder === "asc" && da !== db) return da - db;
        if (sortOrder === "desc" && da !== db) return db - da;
      }

      if (sortName) {
        if (sortName === "az") return a.nama_produk.localeCompare(b.nama_produk);
        if (sortName === "za") return b.nama_produk.localeCompare(a.nama_produk);
      }

      return 0;
    });

    setDisplayedRiwayat(processed);
  }, [masterRiwayat, activeRange, searchTerm, sortOrder, sortName]);

  const formatLocalDate = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
  };

  const handleFilterApply = () => {
    setActiveRange(range);
    setShowPicker(false);
    showNotification("Filter tanggal diterapkan!", "success");
  };

  const handleReset = () => {
    setSearchTerm("");
    setSortOrder("");
    setSortName("");
    setRange(getDefaultDateRange());
    setActiveRange(null);
    setShowPicker(false);
    showNotification("Filter direset.", "info");
  };

  const formatTanggal = (w: string) => {
    const d = new Date(w);
    return new Intl.DateTimeFormat("id-ID", {
      // weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d);
  };

  const dateLabel = useMemo(() => {
    const r = activeRange || range;
    const s = formatLocalDate(r[0].startDate);
    const e = formatLocalDate(r[0].endDate);

    return (
      <span className="flex items-center gap-2">
        <img src="assets/kalender.png" className="w-5 h-5" />
        <span className={activeRange ? "text-blue-600 font-medium" : ""}>
          {s} - {e}
        </span>
      </span>
    );
  }, [range, activeRange]);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const lastIdx = currentPage * rowsPerPage;
  const firstIdx = lastIdx - rowsPerPage;
  const current = displayedRiwayat.slice(firstIdx, lastIdx);
  const totalPages = Math.ceil(displayedRiwayat.length / rowsPerPage);

  return (
    <div className="p-5 md:p-6 dark:text-gray-100 relative">

      {/* HEADER */}
      <div className="flex items-center gap-2 mb-5">
        <img src="assets/riwayat.png" className="w-10 h-10 md:w-10 md:h-10" />
        <h2 className="text-xl md:text-xl font-bold">Riwayat Penimbangan</h2>
      </div>

      {/* FILTER */}
      <div className="
        flex flex-col md:flex-row flex-wrap
        gap-3 mb-5 bg-white dark:bg-gray-800
        p-4 rounded-xl shadow-md relative
      ">
        <input
          id="searchProduk"
          name="searchProduk"
          type="text"
          value={searchTerm}
          placeholder="Cari produk..."
          onChange={(e) => setSearchTerm(e.target.value)}
          className="
            border dark:border-gray-700 rounded-xl px-4 py-2
            bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
            w-full md:w-auto flex-grow
          "
        />

        <button
          onClick={() => setShowPicker(!showPicker)}
          className="
            flex items-center gap-2 border rounded-xl px-3 py-2
            w-full sm:w-auto justify-center
          "
        >
          {dateLabel}
        </button>

        {showPicker && (
          <div className="absolute top-28 md:top-16 z-50 bg-white shadow-lg rounded-xl p-3">
            <DateRange
              editableDateInputs={true}
              ranges={range}
              onChange={(item) => setRange([item.selection])}
              rangeColors={["#3b82f6"]}
              direction="horizontal"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleFilterApply}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Terapkan
              </button>
            </div>
          </div>
        )}

      <button
        onClick={handleReset}
        className="
          flex items-center justify-center
          border border-red-500 text-red-500
          hover:bg-red-50 dark:hover:bg-gray-700
          rounded-xl transition

          p-2
          w-auto
          flex-shrink-0
          mx-auto sm:mx-0
        "
      >
        <img src="assets/reset1.png" alt="Reset" className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="hidden sm:inline text-sm ml-1">Reset</span>
      </button>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="text-center py-6">Memuat...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="w-full border-collapse bg-white dark:bg-gray-900 text-xs md:text-sm">
            <thead className="bg-gray-300 dark:bg-gray-800bg-gray-200 dark:bg-gray-800 uppercase text-sm font-semibold">
              <tr>
                <th className="py-3 px-4 text-center">No</th>
                <th className="py-3 px-4 text-left">Nama Produk</th>
                <th className="py-3 px-4 text-center">Berat (Kg)</th>
                <th className="py-3 px-4 text-center">Harga/Kg</th>
                <th className="py-3 px-4 text-center">Total Harga</th>
                <th className="py-3 px-4 text-center">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {current.length > 0 ? (
                current.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="py-2 px-4 text-center">
                      {firstIdx + idx + 1}
                    </td>
                    <td className="py-2 px-4">
                      {r.nama_produk}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {r.berat.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-center">
                      Rp {r.harga_per_kg.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2 px-4 text-center text-blue-600 font-semibold">
                      Rp {r.total_harga.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {formatTanggal(r.waktu)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ✅ PAGINATION — Riwayat */}
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
          Showing {current.length > 0 ? firstIdx + 1 : 0} to{" "}
          {Math.min(lastIdx, displayedRiwayat.length)} of{" "}
          {displayedRiwayat.length} rows
        </span>

        <div className="flex items-center gap-6 mx-auto md:mx-0">

          {/* Rows per page */}
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
              {[10, 25, 50, 75, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* ✅ Improved pagination */}
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

            {/* Left dots */}
            {currentPage > 3 && <span className="px-2">...</span>}

            {/* Middle pages */}
            {[currentPage - 1, currentPage, currentPage + 1]
              .filter((p) => p > 1 && p < totalPages)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`
                    px-3 py-1 rounded-lg transition
                    ${
                      currentPage === p
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }
                  `}
                >
                  {p}
                </button>
              ))}

            {/* Right dots */}
            {currentPage < totalPages - 2 && <span className="px-2">...</span>}

            {/* Last page (if >1) */}
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

      <ModalNotifikasi
        isOpen={isModalOpen}
        message={modalMessage}
        status={modalStatus}
        onClose={closeModal}
      />
    </div>
  );
};

export default RiwayatPenimbangan;
