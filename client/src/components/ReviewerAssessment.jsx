import React, { useEffect, useState } from "react";
import { thesisAPI } from "../services/api";

const ReviewerAssessment = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await thesisAPI.getReviewerTasks();
        setTasks(data);
      } catch (err) {
        console.error("Ошибка загрузки заданий", err);
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, []);

  if (loading) return <div className="text-center p-6">Загрузка...</div>;

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <h1 className="text-2xl font-comfortaa mb-6">Оценка работ</h1>
      {tasks.length === 0 && <p className="text-gray-500">Нет назначенных заданий.</p>}
      {tasks.map((task) => (
        <div key={task.id} className="card mb-4">
          <h2 className="font-semibold">{task.thesis_title}</h2>
          <p className="text-gray-600 text-sm mb-3">{task.student_name}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.target);
              await thesisAPI.submitReview(task.id, {
                grade: form.get("grade"),
                comment: form.get("comment"),
              });
              alert("Оценка отправлена!");
            }}
          >
            <input name="grade" type="number" placeholder="Оценка" className="input mb-2" required />
            <textarea name="comment" placeholder="Комментарий" className="input mb-2 h-24" required></textarea>
            <button className="btn w-full">Отправить</button>
          </form>
        </div>
      ))}
    </div>
  );
};

export default ReviewerAssessment;
