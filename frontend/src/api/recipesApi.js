import axiosInstance from './axios';

export const getAllRecipes = async (category = null) => {
  const params = category ? { category } : {};
  const res = await axiosInstance.get('/recipes', { params });
  return res.data;
};

export const getRecipeById = async (id) => {
  const res = await axiosInstance.get(`/recipes/${id}`);
  return res.data;
};

export const createRecipe = async (data) => {
  const res = await axiosInstance.post('/recipes', data);
  return res.data;
};

export const updateRecipe = async (id, data) => {
  const res = await axiosInstance.patch(`/recipes/${id}`, data);
  return res.data;
};

export const deleteRecipe = async (id) => {
  const res = await axiosInstance.delete(`/recipes/${id}`);
  return res.data;
};

export const searchRecipes = async (query) => {
  const res = await axiosInstance.get('/recipes/search', { params: { query } });
  return res.data;
};
