"use client";

export default function MembershipManager() {
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <h2>Access Policy</h2>
      <p className="muted">
        UP Teacher Master is currently completely free for every student.
        Premium plans, subscriptions and online payments are disabled.
      </p>
      <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, padding: 16 }}>
        <strong>Free access enabled</strong>
        <p style={{ marginBottom: 0 }}>
          Students can use the available courses, practice tests and mock tests without purchasing a membership.
        </p>
      </div>
    </section>
  );
}
