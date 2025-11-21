import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await login({ email, password });
      const rolePathMap = {
        student: '/student',
        reviewer: '/reviewer',
        admin: '/admin',
        supervisor: '/supervisor',
        consultant: '/consultant',
        head_of_department: '/head',
        head: '/head',
        dean: '/dean'
      };
      const path = rolePathMap[data.user.role] || '/student';
      navigate(path);
    } catch {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-96">
        <h1 className="text-2xl font-comfortaa text-center mb-4">Вход в систему</h1>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            className="input mb-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="input mb-4"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button className="btn w-full">Войти</button>
        </form>
        <p className="text-sm text-gray-500 mt-3 text-center">
          Нет аккаунта? <a href="/register" className="text-blue-600 hover:underline">Зарегистрируйтесь</a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
