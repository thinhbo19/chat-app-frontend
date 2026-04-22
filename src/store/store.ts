import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import chatSettingsReducer from "./chatSettingsSlice";
import chatReducer from "./chatSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chatSettings: chatSettingsReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
