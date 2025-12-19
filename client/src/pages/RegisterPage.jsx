import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "student",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const roles = [
    { value: "student", label: "Студент" },
    { value: "reviewer", label: "Рецензент" },
    { value: "supervisor", label: "Научный руководитель" },
    { value: "consultant", label: "Консультант" },
    { value: "head_of_department", label: "Глава кафедры" },
    { value: "dean", label: "Декан" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // fullName, email, password, role 
      const result = await register(form);
      // По роли отправляет на правильный дашборд 
      const role = form.role;
      navigate(`/${role}`, { replace: true });
    } catch (err) {
      const msg = err?.message || err?.detail || JSON.stringify(err) || "Ошибка регистрации";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="app-container w-full max-w-md">
        <div className="card">
          <h1 className="text-2xl mb-1">Регистрация</h1>
          <div className="muted mb-4">Создать аккаунт</div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="muted small">ФИО</label>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className="mt-1 w-full border rounded p-2"
                required
              />
            </div>

            <div>
              <label className="muted small">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="mt-1 w-full border rounded p-2"
                required
              />
            </div>

            <div>
              <label className="muted small">Пароль</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="mt-1 w-full border rounded p-2"
                required
              />
            </div>

            <div>
              <label className="muted small">Роль</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="mt-1 w-full border rounded p-2"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <div className="text-red-600 small">{error}</div>}

            <div className="flex items-center justify-between">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Зарегистрироваться"}
              </button>
              <a href="/login" className="muted small">Уже есть аккаунт?</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
