import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { thesisAPI } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveToken = (token) => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  };

  const login = async (credentials) => {
    const res = await thesisAPI.login(credentials);
    if (res?.token) saveToken(res.token);
    if (res?.user) setUser(res.user);
    return res;
  };

  const register = async (payload) => {
    const res = await thesisAPI.register(payload);
    return res;
  };

  const logout = useCallback(async () => {
    try {
      await thesisAPI.logout();
    } catch (err) {
      // ignore
    } finally {
      saveToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return null;
    }
    try {
      const me = await thesisAPI.me();
      setUser(me);
      return me;
    } catch (err) {
      saveToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    user,
    setUser,
    login,
    register,
    logout,
    loading,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
