import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getStoredUser } from "../services/api";
import type { AuthUser } from "../types";

type AuthState = {
  user: AuthUser | null;
};

const initialState: AuthState = {
  user: getStoredUser<AuthUser>(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
