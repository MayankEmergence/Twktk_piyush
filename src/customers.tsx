import { useEffect, useState } from "react";
import { api } from "./api";
export default function Customers() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<any>({ customers: [], hasMore: false }),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api(
      "/admin/customers?search=" +
        encodeURIComponent(query) +
        "&offset=" +
        offset,
    )
      .then((value) => {
        if (active) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [query, offset]);
  return (
    <section className="customer-section">
      <h3>Customers</h3>
      <p className="muted">
        Customer contact details are visible only to authorized admins. Export
        Excel includes all customers and their booking details.
      </p>
      <form
        className="customer-search"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setQuery(search);
        }}
      >
        <label>
          Search name, email or phone
          <input
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a customer"
          />
        </label>
        <button className="button">SEARCH</button>
      </form>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Bookings</th>
              <th>Paid bookings</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((c: any) => (
              <tr key={c.id}>
                <td>{c.full_name || "Not provided yet"}</td>
                <td>{c.email}</td>
                <td>{c.phone || "Not provided yet"}</td>
                <td>{c.bookings}</td>
                <td>{c.paid_bookings}</td>
              </tr>
            ))}
            {!data.customers.length && !error && (
              <tr>
                <td colSpan={5}>No matching customers.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="customer-paging">
        <button
          className="text-link"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          ← PREVIOUS
        </button>
        <span>Page {Math.floor(offset / 100) + 1}</span>
        <button
          className="text-link"
          disabled={!data.hasMore}
          onClick={() => setOffset(offset + 100)}
        >
          NEXT →
        </button>
      </div>
    </section>
  );
}
