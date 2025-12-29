import { useState, useEffect } from "react";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";

const API_URL = import.meta.env.VITE_API_URL || "http://192.168.10.214:4000";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
    created_at: string;
    avatar?: string;
  } | null>(null);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  // Ambil data user dari API
  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();

          const formattedUser = {
            name: `${data.first_name} ${data.last_name}`,
            email: data.email,
            role: data.role,
            created_at: data.created_at,
            avatar: "./images/user/user-05.jpg",
          };

          localStorage.setItem("user", JSON.stringify(formattedUser));
          setUser(formattedUser);
        }
      } catch (err) {
        console.error("Gagal mengambil data user:", err);
      }
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/signin";
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        {/* FOTO USER */}
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
          <img
            src={user?.avatar || "./images/user/user-05.jpg"}
            alt="User"
          />
        </span>

        {/* NAMA USER */}
        <span className="block mr-1 font-medium text-theme-sm">
          {user?.name || "User"}
        </span>

        {/* ICON ARROW */}
        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* DROPDOWN */}
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* HEADER: NAMA + EMAIL */}
        <div>
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {user?.name || "Unknown User"}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {user?.email || "No email"}
          </span>
        </div>

        {/* MENU */}
        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          {/* MENU: Edit Profile */}
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm
                        hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
              >
                <circle cx="12" cy="12" r="9" />
              </svg>
              Edit Profile
            </DropdownItem>
          </li>

          {/* MENU: Account Settings */}
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm
                        hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
              >
                <rect x="4" y="4" width="16" height="16" rx="3" />
              </svg>
              Account Settings
            </DropdownItem>
          </li>
        </ul>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="flex items-center w-full gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          <svg
            className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-300"
            width="24"
            height="24"
          >
            <path d="M15 3H9v2h6v14H9v2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
            <path d="M5 12l4-4v3h6v2H9v3l-4-4z" />
          </svg>
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
