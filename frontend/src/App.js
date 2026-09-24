import React, { useEffect, useState } from "react";
import "./App.css";

const API =
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000";

function App() {
  const [page, setPage] = useState("generate");
  const [colleges, setColleges] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [applicationId, setApplicationId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    college_id: "",
    title: "",
    applicant_name: "",
    applicant_address: "",
    date: new Date().toISOString().split("T")[0],
    inventors: [
      {
        inventor_name: "",
        inventor_address: ""
      }
    ]
  });

  useEffect(() => {
    fetch(`${API}/api/colleges`)
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.message || "Failed to load colleges"
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid colleges response from backend"
          );
        }

        return data;
      })
      .then((data) => setColleges(data))
      .catch((error) => {
        setColleges([]);
        setMessage(
          error.message || "Backend connection failed"
        );
      });
  }, []);

  function selectCollege(e) {
    const id = e.target.value;

    const college = colleges.find(
      (item) => String(item.id) === id
    );

    setForm({
      ...form,
      college_id: id,
      applicant_name: college
        ? college.college_name
        : "",
      applicant_address: college
        ? college.college_address
        : ""
    });
  }

  function changeField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  function changeInventor(index, field, value) {
    const updated = [...form.inventors];

    updated[index] = {
      ...updated[index],
      [field]: value
    };

    setForm({
      ...form,
      inventors: updated
    });
  }

  function addInventor() {
    if (form.inventors.length >= 15) return;

    setForm({
      ...form,
      inventors: [
        ...form.inventors,
        {
          inventor_name: "",
          inventor_address: ""
        }
      ]
    });
  }

  function removeInventor(index) {
    if (form.inventors.length === 1) return;

    setForm({
      ...form,
      inventors: form.inventors.filter(
        (_, i) => i !== index
      )
    });
  }

  async function addApplication(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/applications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Failed"
        );
      }

      setDocuments(data.files || []);
      setApplicationId(data.applicationId || null);
      setMessage(
        "Documents generated successfully."
      );
      setPage("documents");
    } catch (error) {
      setMessage(error.message);
    }

    setLoading(false);
  }

  return (
    <div className="app">

      {/* NAVBAR */}
      <header className="navbar">

        <div
          className="brand"
          aria-label="KRCE Document Portal"
        >
          <div
            className="brand-mark"
            aria-hidden="true"
          >
            KRCE
          </div>

          <div className="brand-info">
            <strong>KRCE</strong>
            <span>Document Portal</span>
          </div>
        </div>

        <nav className="nav-links">
          <button
            type="button"
            onClick={() => setPage("dashboard")}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setPage("generate")}
          >
            Generate Document
          </button>

          <button
            type="button"
            onClick={() => setPage("documents")}
          >
            My Documents
          </button>
        </nav>

      </header>

      {/* MAIN */}
      <main className="container">

        {message && (
          <div className="message">
            {message}
          </div>
        )}

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <section className="dashboard-page">

            <div className="page-heading">
              <h1>KRC Document Portal</h1>
              <p>
                Generate patent documents easily.
              </p>
            </div>

            <div className="welcome">
              <h2>Welcome to KRC Document Portal</h2>

              <p>
                Create and manage your official
                patent documents.
              </p>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  setPage("generate")
                }
              >
                Generate Document
              </button>
            </div>

          </section>
        )}

        {/* GENERATE */}
        {page === "generate" && (
          <form
            onSubmit={addApplication}
            className="generate-page"
          >

            {/* PAGE HEADING */}
            <div className="page-heading">
              <h1>Generate Document</h1>

              <p>
                Fill in the details to generate
                your official document
              </p>
            </div>

            {/* TOP SECTION */}
            <div className="generate-grid">

              {/* DOCUMENT DETAILS */}
              <section className="card document-details-card">

                <div className="section-heading">
                  <div className="section-icon">
                    📄
                  </div>

                  <div>
                    <h2>Document Details</h2>
                    <p>
                      Enter the required information
                      to generate your document
                    </p>
                  </div>
                </div>

                <div className="form-grid">

                  <div className="form-group full-width">
                    <label>College</label>

                    <select
                      value={form.college_id}
                      onChange={selectCollege}
                      required
                    >
                      <option value="">
                        Select College
                      </option>

                      {colleges.map((college) => (
                        <option
                          key={college.id}
                          value={college.id}
                        >
                          {college.college_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Title</label>

                    <input
                      name="title"
                      value={form.title}
                      onChange={changeField}
                      placeholder="Enter title"
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Applicant Name</label>

                    <input
                      name="applicant_name"
                      value={form.applicant_name}
                      onChange={changeField}
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>
                      Applicant Address
                    </label>

                    <textarea
                      name="applicant_address"
                      value={form.applicant_address}
                      onChange={changeField}
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Date</label>

                    <input
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={changeField}
                      required
                    />
                  </div>

                </div>

              </section>

            </div>

            {/* INVENTOR SECTION */}
            <section className="card inventor-section">

              <div className="inventor-header">

                <div className="section-heading">
                  <div className="section-icon">
                    👤
                  </div>

                  <div>
                    <h2>Inventor Details</h2>
                    <p>
                      Add inventor information
                    </p>
                  </div>
                </div>

                <div className="inventor-actions">

                  <span className="inventor-count">
                    {form.inventors.length} / 15
                  </span>

                  <button
                    type="button"
                    onClick={addInventor}
                    className="secondary"
                  >
                    + Add Inventor
                  </button>

                </div>

              </div>

              <div className="inventor-list">

                {form.inventors.map(
                  (inventor, index) => (

                    <div
                      className="inventor"
                      key={index}
                    >

                      <div className="inventor-card-header">

                        <h3>
                          Inventor {index + 1}
                        </h3>

                        {form.inventors.length > 1 && (
                          <button
                            type="button"
                            className="remove"
                            onClick={() =>
                              removeInventor(index)
                            }
                          >
                            Remove
                          </button>
                        )}

                      </div>

                      <div className="inventor-grid">

                        <div className="form-group">
                          <label>
                            Inventor Name
                          </label>

                          <input
                            value={
                              inventor.inventor_name
                            }
                            onChange={(e) =>
                              changeInventor(
                                index,
                                "inventor_name",
                                e.target.value
                              )
                            }
                            placeholder="Enter inventor name"
                          />
                        </div>

                        <div className="form-group">
                          <label>
                            Inventor Address
                          </label>

                          <textarea
                            value={
                              inventor.inventor_address
                            }
                            onChange={(e) =>
                              changeInventor(
                                index,
                                "inventor_address",
                                e.target.value
                              )
                            }
                            placeholder="Enter inventor address"
                          />
                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </section>

            {/* ACTION */}
            <div className="form-actions">

              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  setForm({
                    college_id: "",
                    title: "",
                    applicant_name: "",
                    applicant_address: "",
                    date: new Date()
                      .toISOString()
                      .split("T")[0],
                    inventors: [
                      {
                        inventor_name: "",
                        inventor_address: ""
                      }
                    ]
                  });

                  setMessage("");
                }}
              >
                Reset
              </button>

              <button
                type="submit"
                className="add"
                disabled={loading}
              >
                {loading
                  ? "Adding..."
                  : "Add"}
              </button>

            </div>

          </form>
        )}

        {/* MY DOCUMENTS */}
        {page === "documents" && (
          <section className="documents-page">

            <div className="page-heading">
              <h1>My Documents</h1>

              <p>
                Download your generated documents
              </p>
            </div>

            {documents.length === 0 ? (
              <div className="empty">
                No documents generated yet.
              </div>
            ) : (
              <>

                <div className="download-all-bar">
                  <a
                    href={`${API}/api/applications/${applicationId}/documents/zip`}
                    download
                    className="download download-all"
                  >
                    ⬇ Download All Documents
                  </a>
                </div>

                <div className="documents-list">

                  {documents.map((doc) => (

                    <div
                      className="document"
                      key={doc.filename}
                    >

                      <div className="document-info">

                        <div className="document-icon">
                          📄
                        </div>

                        <div>
                          <h3>{doc.form}</h3>
                          <p>{doc.displayName || doc.filename}</p>
                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              </>
            )}

          </section>
        )}

      </main>

    </div>
  );
}

export default App;