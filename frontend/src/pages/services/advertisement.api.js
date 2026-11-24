import api from "../../api/axios";

// =============================
// Create Advertisement
// =============================
export const createAdvertisement = (data, onUploadProgress) =>
  api.post("/advertisement/create", data, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });

// =============================
// Update Advertisement
// =============================
export const updateAdvertisement = (id, data, onUploadProgress) =>
  api.put(`/advertisement/edit/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });

// =============================
// Get Advertisement By ID
// =============================
export const getAdvertisementById = (id) =>
  api.get(`/advertisement/details/${id}`);

// =============================
// Get All Advertisements
// =============================
export const getAdvertisement = () =>
  api.get("/advertisement/list");

// =============================
// Delete Advertisement
// =============================
export const deleteAdvertisement = (id) =>
  api.delete(`/advertisement/delete/${id}`);
