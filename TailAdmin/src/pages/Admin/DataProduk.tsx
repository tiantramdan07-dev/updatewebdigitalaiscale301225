import React, { useEffect, useRef, useState } from "react";
// Import Modal Notifikasi dan tipe status yang sudah diperbaiki
import ModalNotifikasi, {
  ModalStatus,
} from "../../components/modal/ModalNotifikasi";
// Import Modal Konfirmasi
import ModalKonfirmasi from "../../components/modal/ModalKonfirmasi";

const API_URL = "http://192.168.10.214:4000"; // Ganti sesuai server Flask Anda

interface Produk {
  kode_produk: number;
  nama_produk: string;
  harga_per_kg: number;
  path_gambar: string;
}

const DataProduk: React.FC = () => {
  const [products, setProducts] = useState<Produk[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Produk[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [namaProduk, setNamaProduk] = useState("");
  const [hargaPerKg, setHargaPerKg] = useState("");
  const [gambarFile, setGambarFile] = useState<File | null>(null);
  const [editingProduct, setEditingProduct] = useState<Produk | null>(null);

  // === State Modal Notifikasi ===
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalStatus, setModalStatus] = useState<ModalStatus>(null);

  // === State Modal Konfirmasi ===
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  // ========== AUTOSCROLL FORM REF ==========
  const formRef = useRef<HTMLDivElement | null>(null);

  // ===================================
  // FUNGSI UTILITY MODAL
  // ===================================
  const showNotification = (message: string, status: ModalStatus) => {
    setModalMessage(message);
    setModalStatus(status);
    setIsNotifModalOpen(true);
  };

  const closeNotificationModal = () => setIsNotifModalOpen(false);
  const closeConfirmModal = () => {
    setProductToDelete(null);
    setIsConfirmModalOpen(false);
  };

  // ===================================
  // FUNGSI CRUD
  // ===================================
  useEffect(() => {
    fetchProduk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProduk = async () => {
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      if (!token) {
        window.location.href = "/signin";
        return;
      }

      const res = await fetch(`${API_URL}/api/produk`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Token invalid / expired
      if (res.status === 401) {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");

        showNotification(
          "Sesi login berakhir. Silakan login kembali!",
          "error"
        );

        setTimeout(() => {
          window.location.href = "/signin";
        }, 800);

        return;
      }

      // Error lain
      if (!res.ok) {
        showNotification(
          "Gagal memuat daftar produk. Token tidak valid!",
          "error"
        );
        return;
      }

      // Jika sukses
      const data = await res.json();
      setProducts(data);
      setFilteredProducts(data);

      // ⬅⬅⬅ NOTIFIKASI BERHASIL (seperti Riwayat)
      showNotification("Berhasil memuat data produk!", "success");

    } catch (err) {
      console.error("Gagal memuat produk:", err);
      showNotification("Terjadi kesalahan koneksi ke server!", "error");
    }
  };

  // === SEARCH PRODUK ===
  useEffect(() => {
    const filtered = products.filter((p) =>
      p.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const handleResetSearch = () => {
    setSearchTerm("");
    setFilteredProducts(products);
    showNotification(
      "Pencarian telah direset dan semua produk ditampilkan kembali.",
      "info"
    );
  };

  // === TAMBAH PRODUK ===
  const handleAddProduct = async () => {
    if (!namaProduk.trim() || !hargaPerKg.trim() || !gambarFile) {
      showNotification(
        "Nama produk, harga, dan gambar wajib diisi sebelum menambahkan produk!",
        "warning"
      );
      return;
    }

    const formData = new FormData();
    formData.append("nama_produk", namaProduk);
    formData.append("harga_per_kg", hargaPerKg);
    formData.append("gambar", gambarFile);

    try {
      const token = localStorage.getItem("token"); // ✅ ADD THIS
      const res = await fetch(`${API_URL}/api/produk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, // ✅ ADD THIS
        },
        body: formData,
      });

      if (res.ok) {
        await fetchProduk();
        setNamaProduk("");
        setHargaPerKg("");
        setGambarFile(null);
        const fileInput = document.getElementById(
          "file-input"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        showNotification("Produk berhasil ditambahkan!", "success");
      } else {
        showNotification("Gagal menambah produk. Periksa API.", "error");
      }
    } catch (err) {
      console.error("Gagal mengirim produk:", err);
      showNotification(
        "Terjadi kesalahan koneksi saat menambah produk.",
        "error"
      );
    }
  };

  // === HAPUS PRODUK ===
  const handleDeleteClick = (id: number) => {
    const product = products.find((p) => p.kode_produk === id);
    if (!product) return;

    setModalMessage(
      `Apakah kamu yakin ingin menghapus produk "${product.nama_produk}"?`
    );
    setProductToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) {
      showNotification("Tidak ada produk yang dipilih untuk dihapus!", "warning");
      return;
    }

    const id = productToDelete;
    setProductToDelete(null);
    setIsConfirmModalOpen(false);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/produk/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.kode_produk !== id));
        setFilteredProducts((prev) =>
          prev.filter((p) => p.kode_produk !== id)
        );
        showNotification("Produk berhasil dihapus!", "success");
      } else {
        showNotification("Gagal menghapus produk. Periksa API.", "error");
      }
    } catch (err) {
      console.error("Gagal hapus:", err);
      showNotification(
        "Terjadi kesalahan koneksi saat menghapus produk.",
        "error"
      );
    }
  };

  // === EDIT PRODUK ===
  const startEdit = (produk: Produk) => {
    setEditingProduct(produk);
    setNamaProduk(produk.nama_produk);
    setHargaPerKg(produk.harga_per_kg.toString());
    setGambarFile(null);
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";

    // ========== AUTO SCROLL KE FORM + AUTO FOCUS INPUT ==========
    // gunakan timeout kecil agar state sudah ter-update & DOM siap
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        // beri sedikit delay sebelum fokus agar browser sudah menyelesaikan scroll
        setTimeout(() => {
          const namaEl = document.getElementById(
            "namaProduk"
          ) as HTMLInputElement | null;
          namaEl?.focus();
          // optional: select text
          if (namaEl) {
            namaEl.select();
          }
        }, 200);
      }
    }, 80);
  };

  const handleUpdate = async () => {
    if (!editingProduct) return;
    if (!namaProduk.trim() || !hargaPerKg.trim()) {
      showNotification(
        "Nama produk, harga dan gambar wajib diisi sebelum memperbarui!",
        "warning"
      );
      return;
    }

    const formData = new FormData();
    formData.append("nama_produk", namaProduk);
    formData.append("harga_per_kg", hargaPerKg);
    if (gambarFile) formData.append("gambar", gambarFile);

    try {
      const token = localStorage.getItem("token"); // ✅ ADD THIS
      const res = await fetch(
        `${API_URL}/api/produk/${editingProduct.kode_produk}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`, // ✅ ADD THIS
          },
          body: formData,
        }
      );

      if (res.ok) {
        await fetchProduk();
        cancelEdit();
        showNotification("Produk berhasil diperbarui!", "success");
      } else {
        showNotification("Gagal update produk. Periksa API.", "error");
      }
    } catch (err) {
      console.error("Gagal update:", err);
      showNotification(
        "Terjadi kesalahan koneksi saat update produk.",
        "error"
      );
    }
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setNamaProduk("");
    setHargaPerKg("");
    setGambarFile(null);
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstRow,
    indexOfLastRow
  );

  // ===================================
  // RENDER
  // ===================================
  return (
    <div className="p-5 dark:bg-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center gap-1 mb-5">
        <img
          src="assets/dataproduk.png"
          alt="Daftar Produk Icon"
          className="w-10 h-10 md:w-10 md:h-10"
        />
        <h2 className="text-xl md:text-xl font-bold">Data Produk</h2>
      </div>

      {/* FORM INPUT */}
      <div
        ref={formRef}
        className="flex flex-wrap gap-3 mb-5 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md"
      >
        <input
          id="namaProduk"
          name="namaProduk"
          type="text"
          placeholder="Nama Produk"
          className="border dark:border-gray-700 rounded-lg px-3 py-2 flex-1 bg-transparent"
          value={namaProduk}
          onChange={(e) => setNamaProduk(e.target.value)}
        />
        
        <input
          id="hargaPerKg"
          name="hargaPerKg"
          type="number"
          placeholder="Harga per Kg"
          className="border dark:border-gray-700 rounded-lg px-3 py-2 w-40 bg-transparent"
          min="0"
          value={hargaPerKg}
          onChange={(e) => {
            const value = e.target.value;
            if (Number(value) < 0) return; // Cegah minus
            setHargaPerKg(value);
          }}
        />

        <div className="flex items-center gap-3">
          <label
            htmlFor="file-input"
            className="border dark:border-gray-700 rounded-lg px-3 py-2 flex-1 
                    bg-transparent text-gray-800 dark:text-gray-200 cursor-pointer
                    hover:ring-2 hover:ring-blue-500 transition flex items-center justify-between"
          >
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1 rounded-md">
              Pilih File
            </span>
            <span className="ml-3 truncate text-sm text-gray-500 dark:text-gray-400">
              {gambarFile ? gambarFile.name : "Upload Gambar"}
            </span>
          </label>

          {/* input aslinya tetap ada tapi disembunyikan */}
          <input
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setGambarFile(e.target.files?.[0] || null)}
          />
        </div>

        {editingProduct ? (
          <>
            <button
              onClick={handleUpdate}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <img
                src="assets/save.png"
                alt="Simpan"
                className="w-5 h-5 object-contain"
              />
              Simpan Perubahan
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <img
                src="assets/gagal.png"
                alt="Batal"
                className="w-5 h-5 object-contain"
              />
              Batal
            </button>
          </>
        ) : (
          <button
            onClick={handleAddProduct}
            className="flex items-center gap-2 border border-blue-600 text-blue-600 bg-white hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg transition"
          >
            <img
              src="assets/tambah.png"
              alt="Tambah Produk"
              className="w-5 h-5 object-contain"
            />
            Tambah Produk
          </button>
        )}
      </div>

      {/* 🔍 SEARCH BAR */}
      <div className="flex items-center gap-3 mb-5 mt-15">
        {/* INPUT + ICON */}
        <div className="relative w-full max-w-sm">
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <input
            id="searchTerm"
            name="searchTerm"
            type="text"
            placeholder="Cari produk berdasarkan nama..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border dark:border-gray-700 rounded-xl pl-10 pr-3 py-2 w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <button
          onClick={handleResetSearch}
          className="
            flex items-center justify-center
            border border-red-500 text-red-500
            hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-gray-700
            rounded-xl transition

            px-2 py-2 min-w-9
            sm:px-3 sm:py-2
          "
        >
          <img
            src="assets/reset1.png"
            alt="Reset"
            className="w-5 h-5 sm:w-6 sm:h-6"
          />
          <span className="hidden sm:inline text-sm ml-1">Reset</span>
        </button>
      </div>

      {/* Total Data */}
      <div className="mb-5">
        <span
          className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium 
                  bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
        >
          Total Produk: {filteredProducts.length}
        </span>
      </div>

      {/* TABEL PRODUK */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full border-collapse bg-white dark:bg-gray-900 text-sm">
          <thead className="bg-gray-300 dark:bg-gray-800bg-gray-200 dark:bg-gray-800 uppercase text-sm font-semibold">
            <tr>
              {/* <th className="py-3 px-4 border-b text-center">ID</th> */}
              <th className="py-3 px-4 text-center">No</th>
              <th className="py-3 px-4 border-b text-left">Nama Produk</th>
              <th className="py-3 px-4 border-b text-center">Harga/Kg</th>
              <th className="py-3 px-4 border-b text-center">Gambar</th>
              <th className="py-3 px-4 border-b text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentProducts.map((p, index) => (
              <tr
                key={p.kode_produk}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <td className="py-2 px-4 border-b text-center">
                  {indexOfFirstRow + index + 1}
                </td>
                <td className="py-2 px-4 border-b text-left font-medium">
                  {p.nama_produk}
                </td>
                <td className="py-2 px-4 border-b text-center">
                  Rp {p.harga_per_kg.toLocaleString("id-ID")}
                </td>
                <td className="py-2 px-4 border-b text-center">
                  <img
                    src={`${API_URL}${p.path_gambar}`}
                    alt={p.nama_produk}
                    className="w-14 h-14 object-contain mx-auto rounded bg-white"
                    onError={(e) => (e.currentTarget.src = "/noimage.png")}
                  />
                </td>
                <td className="py-2 px-4 border-b text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="
                    flex items-center justify-center
                    border border-yellow-500 text-yellow-600
                    bg-white hover:bg-yellow-50 dark:bg-gray-800 dark:hover:bg-gray-700
                    rounded-lg transition

                    px-2 py-2 min-w-9
                    sm:px-3 sm:py-1.5
                  "
                    >
                      <img
                        src="assets/edit.png"
                        alt="Edit"
                        className="w-5 h-5 sm:w-6 sm:h-6"
                      />
                      <span className="hidden sm:inline text-sm ml-1">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(p.kode_produk)}
                      className="
                    flex items-center justify-center
                    border border-red-600 text-red-600
                    bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-gray-700
                    rounded-lg transition

                    px-2 py-2 min-w-9
                    sm:px-3 sm:py-1.5
                  "
                    >
                      <img
                        src="assets/delete.png"
                        alt="Hapus"
                        className="w-5 h-5 sm:w-6 sm:h-6"
                      />
                      <span className="hidden sm:inline text-sm ml-1">Hapus</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-5 text-gray-500 dark:text-gray-400">
                  Tidak ada produk yang cocok dengan pencarian.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Notifikasi */}
      <ModalNotifikasi
        isOpen={isNotifModalOpen}
        message={modalMessage}
        status={modalStatus}
        onClose={closeNotificationModal}
      />

      {/* Modal Konfirmasi */}
      {isConfirmModalOpen && (
        <ModalKonfirmasi
          isOpen={isConfirmModalOpen}
          message={modalMessage}
          onConfirm={confirmDelete}
          onCancel={closeConfirmModal}
        />
      )}

      {/* ✅ PAGINATION — Data Produk */}
      <div
        className="
          w-full
          flex flex-col md:flex-row
          md:items-center justify-between
          mt-4 pt-4 pb-8
          text-[10px] md:text-sm gap-3
          flex-wrap
        "
      >
        {/* Showing text */}
        <span className="text-center md:text-left text-gray-700 dark:text-gray-300 max-w-full">
          Showing {(filteredProducts.length === 0 ? 0 : indexOfFirstRow + 1)} to{" "}
          {Math.min(indexOfLastRow, filteredProducts.length)} of {filteredProducts.length} rows
        </span>

        {/* Right section wrapper */}
        <div className="flex items-center gap-4 mx-auto md:mx-0 flex-wrap">

          {/* Rows per page */}
          <div className="flex items-center gap-2">
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
                pl-3 pr-6 py-1
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

          {/* Pagination numbers */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="
                px-2 py-1 border rounded-lg
                disabled:opacity-40 dark:border-gray-700
                hover:bg-gray-200 dark:hover:bg-gray-700 transition
              "
            >
              ‹
            </button>

            {Array.from(
              { length: Math.ceil(filteredProducts.length / rowsPerPage) },
              (_, i) => i + 1
            ).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`
                  px-2 py-1 rounded-lg transition
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

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, Math.ceil(filteredProducts.length / rowsPerPage)))
              }
              disabled={currentPage === Math.ceil(filteredProducts.length / rowsPerPage)}
              className="
                px-2 py-1 border rounded-lg
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

export default DataProduk;
