import { useState } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import ModalNotifikasi, { ModalStatus } from "../modal/ModalNotifikasi";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalStatus, setModalStatus] = useState<ModalStatus>(null);

  async function handleSubmit(e: any) {
    e.preventDefault();

    // semua field wajib terisi
    if (!first.trim() || !last.trim() || !email.trim() || !password.trim()) {
      setModalMessage("Semua kolom wajib diisi.");
      setModalStatus("error");
      setModalOpen(true);
      return;
    }

    // user sudah menyetujui Terms & Conditions
    if (!isChecked) {
      setModalMessage("Anda harus menyetujui Terms and Conditions terlebih dahulu.");
      setModalStatus("error");
      setModalOpen(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://192.168.10.214:4000"}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setModalMessage("Registrasi berhasil. Silakan login.");
        setModalStatus("success");
        setModalOpen(true);

        setTimeout(() => {
          window.location.href = "/signin";
        }, 1500);
      } else {
        setModalMessage(data.error || "Gagal registrasi");
        setModalStatus("error");
        setModalOpen(true);
      }
    } catch (err: any) {
      setModalMessage("Network error: " + err.message);
      setModalStatus("error");
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      
      {/* ✅ MODAL */}
      <ModalNotifikasi
        isOpen={modalOpen}
        message={modalMessage}
        status={modalStatus}
        onClose={() => setModalOpen(false)}
      />

      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="flex flex-col items-center mb-6">
          <img src="images/logo/logoimiwarna.png" alt="Logo Light" className="w-24 h-24 object-contain block dark:hidden" />
          <img src="images/logo/logoimiputih.png" alt="Logo Dark" className="w-24 h-24 object-contain hidden dark:block" />
          <p className="mt-3 text-lg font-semibold text-gray-800 dark:text-white">Timbangan Digital AI</p>
        </div>

        <div>
          <div className="mb-5 sm:mb-8 text-center">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">Sign Up</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Enter your email and password to sign up!</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">

              <div>
                <Label htmlFor="firstName">
                  First Name<span className="text-error-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Enter your first name"
                  autoComplete="given-name"
                  value={first}
                  onChange={(e: any) => setFirst(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="lastName">
                  Last Name<span className="text-error-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Enter your last name"
                  autoComplete="family-name"
                  value={last}
                  onChange={(e: any) => setLast(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="email">
                  Email<span className="text-error-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="password">
                  Password<span className="text-error-500">*</span>
                </Label>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                  />

                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword
                      ? <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      : <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    }
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox className="w-5 h-5" checked={isChecked} onChange={setIsChecked} />
                <p className="inline-block font-normal text-gray-500 dark:text-gray-400">By creating an account, you agree to the <span className="text-gray-800 dark:text-white/90">Terms and Conditions</span> and our <span className="text-gray-800 dark:text-white">Privacy Policy</span></p>
              </div>

              <div>
                <button className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600" type="submit" disabled={loading}>
                  {loading ? "Signing..." : "Sign Up"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Already have an account? <Link to="/AiScale/signin" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Sign In</Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
