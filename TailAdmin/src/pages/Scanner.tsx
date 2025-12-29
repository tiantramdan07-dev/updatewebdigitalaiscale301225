import { useEffect } from "react";
import { useNavigate } from "react-router";
import CameraClient from "../components/CameraClient";

export default function Scanner() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/signin");
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontWeight: "bold" }}>Scanner Kamera Client</h1>
      <CameraClient />
    </div>
  );
}
