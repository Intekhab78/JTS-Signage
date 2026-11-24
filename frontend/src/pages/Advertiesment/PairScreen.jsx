import React, { useCallback, useEffect, useState } from "react";
import { FaSyncAlt } from "react-icons/fa";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import { SOCKET_BASE_URL } from "../../config";

export default function PairScreen() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestCode = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/devices/pair/request");
      setCode(res.data.code);
      setExpiresAt(res.data.expiresAt);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to generate pairing code."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestCode();
  }, [requestCode]);

  useEffect(() => {
    if (!code) return;

    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    const joinPair = () => {
      socket.emit("join_pairing_code", code);
    };

    socket.on("connect", joinPair);
    if (socket.connected) joinPair();

    socket.on("device_paired", ({ screenToken }) => {
      if (screenToken) {
        navigate(`/screen/${screenToken}`, { replace: true });
      }
    });

    return () => socket.disconnect();
  }, [code, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-900 text-white px-4">
      <div className="max-w-lg w-full bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center shadow-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Pair This TV</h1>
        <p className="text-gray-400 text-sm mb-8">
          Enter the 6-digit pairing code below in your Admin Panel under{" "}
          <span className="text-blue-400 font-medium">
            Devices → Pair TV Code
          </span>
          .
        </p>

        {loading ? (
          <p className="text-lg text-gray-300 py-8">Generating code...</p>
        ) : error ? (
          <div className="text-red-400 py-6 space-y-4 flex flex-col items-center">
            <p>{error}</p>
            <ActionIconButton
              icon={FaSyncAlt}
              title="Retry"
              variant="blue"
              size="md"
              onClick={requestCode}
            />
          </div>
        ) : (
          <>
            <div className="bg-gray-950 border border-gray-700 rounded-xl py-6 px-4 mb-4">
              <p className="text-5xl sm:text-6xl font-mono font-extrabold tracking-[0.25em] text-blue-400">
                {code}
              </p>
            </div>
            {expiresAt && (
              <p className="text-xs text-gray-400 mb-6">
                Valid until {new Date(expiresAt).toLocaleTimeString()}
              </p>
            )}
            <div className="flex justify-center">
              <ActionIconButton
                icon={FaSyncAlt}
                title="Generate New Code"
                variant="blue"
                size="md"
                onClick={requestCode}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
