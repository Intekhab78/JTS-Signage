// // src/config.js

// export const API_BASE_URL =
//     import.meta.env.VITE_API_URL ||
//     "https://vms-backend-ctea.onrender.com/api";

// export const SOCKET_BASE_URL =
//     import.meta.env.VITE_SOCKET_URL ||
//     "https://vms-backend-ctea.onrender.com";


export const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.MODE === "development"
        ? "http://localhost:5000/api"
        : "https://vms-backend-ctea.onrender.com/api");

export const SOCKET_BASE_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.MODE === "development"
        ? "http://localhost:5000"
        : "https://vms-backend-ctea.onrender.com");
