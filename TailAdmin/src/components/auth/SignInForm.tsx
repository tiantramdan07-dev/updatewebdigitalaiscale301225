import { useState } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import ModalNotifikasi, { ModalStatus } from "../modal/ModalNotifikasi";
import { useNavigate } from "react-router";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ======== MODAL STATE ========
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<ModalStatus>(null);
  const [modalMessage, setModalMessage] = useState("");

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://192.168.10.214:4000"}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await res.json();

      if (res.ok && data.token) {

        // ✅ LocalStorage jika dicentang
        // ✅ SessionStorage kalau tidak
        const storage = isChecked ? localStorage : sessionStorage;

        storage.setItem("token", data.token);

        storage.setItem(
          "user",
          JSON.stringify({
            first_name: data.user?.first_name || "User",
            last_name: data.user?.last_name || "",
            email: data.user?.email || email,
            avatar: data.user?.avatar || "./images/user/user-05.jpg",
          })
        );

        // ✅ Tampilkan modal sukses
        setModalStatus("success");
        setModalMessage("Login berhasil! Mengalihkan...");
        setIsModalOpen(true);

        // ✅ delay redirect
      setTimeout(() => {
        navigate("/");
      }, 1700);
      } else {
        setModalStatus("error");
        setModalMessage(data.error || "Login gagal!");
        setIsModalOpen(true);
      }
    } catch (err: any) {
      setModalStatus("warning");
      setModalMessage("Network error: " + err.message);
      setIsModalOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-10 mx-auto">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="flex flex-col items-center mb-6">
            <img
              src="images/logo/logoimiwarna.png"
              alt="Logo Light"
              className="w-24 h-24 object-contain block dark:hidden"
            />
            <img
              src="images/logo/logoimiputih.png"
              alt="Logo Dark"
              className="w-24 h-24 object-contain hidden dark:block"
            />
            <p className="mt-3 text-lg font-semibold text-gray-800 dark:text-white">
              Timbangan Digital AI
            </p>
          </div>

          <div className="mb-5 sm:mb-8 text-center">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign in!
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
          <div>
          <Label htmlFor="email">
            Email <span className="text-error-500">*</span>
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
                Password <span className="text-error-500">*</span>
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
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
              </div>

              <div>
                <Button className="w-full" size="sm" type="submit" disabled={loading}>
                  {loading ? "Signing..." : "Sign in"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Don't have an account?{" "}
              <Link
                to="/AiScale/signup"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* === MODAL NOTIF === */}
      <ModalNotifikasi
        isOpen={isModalOpen}
        message={modalMessage}
        status={modalStatus}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
