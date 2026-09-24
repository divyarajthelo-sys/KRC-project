-- KRC Document Portal - database schema
-- Reconstructed from server.js's queries (no schema file existed in
-- the project before now). Run this once against a fresh database
-- before pointing the backend at it.

CREATE DATABASE IF NOT EXISTS krc_documents;
USE krc_documents;

CREATE TABLE IF NOT EXISTS colleges (
    id INT PRIMARY KEY,
    college_name VARCHAR(255) NOT NULL,
    college_address VARCHAR(500) NOT NULL
);

-- Must match the COLLEGES object in backend/documentGenerator.js
-- (same ids), since that file is the source of truth for the
-- /api/colleges dropdown and document text.
INSERT INTO colleges (id, college_name, college_address) VALUES
    (1, 'K.Ramakrishnan College of Engineering', 'NH-45, Samayapuram, Trichy, Tamil Nadu, India- 621112'),
    (2, 'K.Ramakrishnan College of Technology', 'Kariyamanickam Road, Samayapuram, Trichy, Tamil Nadu, India-621112'),
    (3, 'M.Kumarasamy College of Engineering', 'Thalavapalayam, Karur, Tamil Nadu, India-639113')
ON DUPLICATE KEY UPDATE
    college_name = VALUES(college_name),
    college_address = VALUES(college_address);

CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    college_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    applicant_name VARCHAR(255) NOT NULL,
    applicant_address VARCHAR(500) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (college_id) REFERENCES colleges(id)
);

CREATE TABLE IF NOT EXISTS inventors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    inventor_number INT NOT NULL,
    inventor_name VARCHAR(255) NOT NULL,
    inventor_address VARCHAR(500) NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id)
);
