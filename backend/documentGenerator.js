const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const { execFileSync } = require("child_process");

const DOCUMENTS_DIR = path.join(__dirname, "documents");
const GENERATED_DIR = path.join(__dirname, "generated");
const TEMP_DIR = path.join(__dirname, "temp");

/*
    FORM 1's and FORM 5's inventor tables have
    exactly 15 rows, and the UI caps inventors at
    15. Keep every inventor-count limit in this
    file tied to this single constant.
*/
const MAX_INVENTORS = 15;

const COLLEGES = {
    1: {
        name: "K.RAMAKRISHNAN COLLEGE OF ENGINEERING",
        upper: "K.RAMAKRISHNAN COLLEGE OF ENGINEERING",
        address:
            "NH-45, Samayapuram, Trichy, Tamil Nadu, India- 621112"
    },

    2: {
        name: "K.RAMAKRISHNAN COLLEGE OF TECHNOLOGY",
        upper: "K.RAMAKRISHNAN COLLEGE OF TECHNOLOGY",
        address:
            "Kariyamanickam Road, Samayapuram, Trichy, Tamil Nadu, India-621112"
    },

    3: {
        name: "M.KUMARASAMY COLLEGE OF ENGINEERING",
        upper: "M.KUMARASAMY COLLEGE OF ENGINEERING",
        address:
            "Thalavapalayam, Karur, Tamil Nadu, India-639113"
    }
};

const OLD_INVENTORS = [
    {
        name: "Dr Viswanathan Balasubramanian",
        address:
            "Associate professor, Department of ECE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "M.Karthick",
        address:
            "Assistant professor, Department of ECE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "Ragul G",
        address:
            "Student, Department of ECE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "Mohith P S",
        address:
            "Student, Department of EEE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "Prawin K",
        address:
            "Student, Department of ECE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "Ragul R",
        address:
            "Student, Department of ECE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "Vaishnavi S",
        address:
            "Student, Department of ECE, K.Ramakrishnan College of Engineering, Trichy- 621112, India"
    },
    {
        name: "Deva R",
        address:
            "Student, Department of Mechanical, K.Ramakrishnan College of Engineering, Trichy-621112, India"
    }
];

function escapeXml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function decodeXml(value) {
    return String(value ?? "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#xA0;/gi, " ")
        .replace(/\u00a0/g, " ");
}

function normalize(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .trim();
}

function getDateParts(input) {
    const value =
        input ||
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

    const d = new Date(`${value}T00:00:00`);

    if (Number.isNaN(d.getTime())) {
        throw new Error("Invalid date");
    }

    const day = d.getDate();

    let suffix = "th";

    if (day % 10 === 1 && day !== 11) {
        suffix = "st";
    }

    if (day % 10 === 2 && day !== 12) {
        suffix = "nd";
    }

    if (day % 10 === 3 && day !== 13) {
        suffix = "rd";
    }

    const month = d.toLocaleString("en-US", {
        month: "long"
    });

    const year = d.getFullYear();

    return {
        long:
            `${day}${suffix} Day of ${month} ${year}`,

        short:
            `${String(day).padStart(2, "0")}-${String(
                d.getMonth() + 1
            ).padStart(2, "0")}-${year}`,

        year: String(year)
    };
}

function getRuns(xml) {
    return [
        ...xml.matchAll(
            /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g
        )
    ];
}

function isRedRun(runXml) {
    return /<w:color\b[^>]*w:val=["'](?:FF0000|ff0000|red)["']/i.test(
        runXml
    );
}

function getRunText(runXml) {
    return [
        ...runXml.matchAll(
            /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
        )
    ]
        .map((m) => decodeXml(m[1]))
        .join("");
}

function replaceRunText(runXml, text) {
    const escaped = escapeXml(text);

    let first = true;

    return runXml.replace(
        /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
        (full, open, oldText, close) => {
            if (first) {
                first = false;

                return (
                    open +
                    escaped +
                    close
                );
            }

            return open + close;
        }
    );
}

function replaceAllRedText(
    xml,
    oldValue,
    newValue
) {
    const matches = getRuns(xml);

    const groups = [];

    let current = [];

    for (const match of matches) {
        const runXml = match[0];

        const text = getRunText(runXml);

        if (
            isRedRun(runXml) &&
            text.length > 0
        ) {
            current.push({
                xml: runXml,
                text
            });
        } else if (current.length) {
            groups.push(current);
            current = [];
        }
    }

    if (current.length) {
        groups.push(current);
    }

    const target =
        normalize(oldValue);

    if (!target) {
        return xml;
    }

    const replacement =
        String(newValue ?? "");

    for (const group of groups) {
        const starts = [];

        let raw = "";

        for (const run of group) {
            starts.push(raw.length);
            raw += run.text;
        }

        const compact = [];
        const map = [];

        for (
            let i = 0;
            i < raw.length;
            i++
        ) {
            if (!/\s/.test(raw[i])) {
                compact.push(
                    raw[i].toLowerCase()
                );

                map.push(i);
            }
        }

        const compactText =
            compact.join("");

        const ranges = [];

        let from = 0;

        while (true) {
            const position =
                compactText.indexOf(
                    target,
                    from
                );

            if (position === -1) {
                break;
            }

            ranges.push([
                map[position],
                map[
                    position +
                    target.length -
                    1
                ] + 1
            ]);

            from =
                position +
                target.length;
        }

        for (
            let r = ranges.length - 1;
            r >= 0;
            r--
        ) {
            const [
                start,
                end
            ] = ranges[r];

            let startRun = -1;
            let endRun = -1;

            for (
                let i = 0;
                i < group.length;
                i++
            ) {
                const runStart =
                    starts[i];

                const runEnd =
                    runStart +
                    group[i].text.length;

                if (
                    start >= runStart &&
                    start < runEnd
                ) {
                    startRun = i;
                }

                if (
                    end > runStart &&
                    end <= runEnd
                ) {
                    endRun = i;
                    break;
                }
            }

            if (startRun === -1) {
                continue;
            }

            if (endRun === -1) {
                endRun =
                    group.length - 1;
            }

            if (
                startRun === endRun
            ) {
                const localStart =
                    start -
                    starts[startRun];

                const localEnd =
                    end -
                    starts[startRun];

                group[startRun].text =
                    group[startRun].text.slice(
                        0,
                        localStart
                    ) +
                    replacement +
                    group[startRun].text.slice(
                        localEnd
                    );
            } else {
                const localStart =
                    start -
                    starts[startRun];

                const localEnd =
                    end -
                    starts[endRun];

                group[startRun].text =
                    group[startRun].text.slice(
                        0,
                        localStart
                    ) +
                    replacement;

                for (
                    let i = startRun + 1;
                    i < endRun;
                    i++
                ) {
                    group[i].text = "";
                }

                group[endRun].text =
                    group[endRun].text.slice(
                        localEnd
                    );
            }
        }
    }

    const modifiedRuns =
        groups.flat();

    let runIndex = 0;

    return xml.replace(
        /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g,
        (runXml) => {
            if (
                !isRedRun(runXml) ||
                getRunText(runXml).length === 0
            ) {
                return runXml;
            }

            const modified =
                modifiedRuns[runIndex++];

            if (!modified) {
                return runXml;
            }

            return replaceRunText(
                runXml,
                modified.text
            );
        }
    );
}

/* =========================================================
   FORM 1 INVENTOR TABLE
   ========================================================= */

function setCellText(
    cellXml,
    value
) {
    const escaped =
        escapeXml(value);

    let first = true;

    return cellXml.replace(
        /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
        (
            full,
            open,
            oldText,
            close
        ) => {
            if (first) {
                first = false;

                return (
                    open +
                    escaped +
                    close
                );
            }

            return (
                open +
                close
            );
        }
    );
}

function updateForm1InventorTable(
    xml,
    inventors
) {
    const tables = [
        ...xml.matchAll(
            /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g
        )
    ];

    const enteredInventors = inventors.filter(
        (inventor) =>
            inventor &&
            String(
                inventor.inventor_name ||
                ""
            ).trim() !== "" &&
            String(
                inventor.inventor_address ||
                ""
            ).trim() !== ""
    );

    const count = Math.min(
        enteredInventors.length,
        MAX_INVENTORS
    );

    for (const tableMatch of tables) {
        const tableXml =
            tableMatch[0];

        const tableText =
            normalize(
                [
                    ...tableXml.matchAll(
                        /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
                    )
                ]
                    .map((m) =>
                        decodeXml(m[1])
                    )
                    .join(" ")
            );

        const isInventorTable =
            OLD_INVENTORS.some(
                (oldInventor) =>
                    tableText.includes(
                        normalize(
                            oldInventor.name
                        )
                    )
            );

        if (!isInventorTable) {
            continue;
        }

        const rows = [
            ...tableXml.matchAll(
                /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g
            )
        ];

        if (
            rows.length <
            MAX_INVENTORS + 1
        ) {
            continue;
        }

        let rebuilt = "";

        for (
            let rowIndex = 0;
            rowIndex < rows.length;
            rowIndex++
        ) {
            const rowXml =
                rows[rowIndex][0];

            /*
                Row 0 = header

                Rows 1-MAX_INVENTORS =
                Form 1 inventor rows
            */
            if (
                rowIndex >= 1 &&
                rowIndex <= MAX_INVENTORS
            ) {
                const inventorIndex =
                    rowIndex - 1;

                /*
                    Remove unused
                    original inventor rows.
                */
                if (
                    inventorIndex >= count
                ) {
                    continue;
                }

                const inventor =
                    enteredInventors[
                        inventorIndex
                    ] || {};

                const name =
                    String(
                        inventor.inventor_name ||
                        ""
                    ).trim();

                const address =
                    String(
                        inventor.inventor_address ||
                        ""
                    ).trim();

                const cells = [
                    ...rowXml.matchAll(
                        /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g
                    )
                ];

                /*
                    Form 1 inventor table:

                    Cell 1 = Name
                    Cell 2 = Nationality
                    Cell 3 = Country
                    Cell 4 = Address
                */
                if (
                    cells.length >= 4
                ) {
                    let updatedRow =
                        rowXml;

                    updatedRow =
                        updatedRow.replace(
                            cells[0][0],
                            setCellText(
                                cells[0][0],
                                name
                            )
                        );

                    updatedRow =
                        updatedRow.replace(
                            cells[3][0],
                            setCellText(
                                cells[3][0],
                                address
                            )
                        );

                    rebuilt +=
                        updatedRow;
                } else {
                    rebuilt += rowXml;
                }
            } else {
                /*
                    Keep every other
                    original row unchanged.
                */
                rebuilt += rowXml;
            }
        }

        /*
            IMPORTANT: tableXml is the FULL
            <w:tbl>...</w:tbl> block, including
            the table's opening tag, <w:tblPr>
            (borders/style) and <w:tblGrid>
            (column widths). `rebuilt` only
            contains the <w:tr> rows, so it must
            be re-wrapped in that same table
            shell - otherwise the table's border/
            grid definition is lost and the rows
            end up as orphaned <w:tr> elements
            with no <w:tbl> parent.
        */
        const firstRowXml =
            rows[0][0];

        const tablePrefix =
            tableXml.slice(
                0,
                tableXml.indexOf(
                    firstRowXml
                )
            );

        return xml.replace(
            tableXml,
            tablePrefix +
                rebuilt +
                "</w:tbl>"
        );
    }

    return xml;
}

/* =========================================================
   FORM 1 DECLARATION NAMES
   ========================================================= */

function replaceDeclarationName(
    paragraphXml,
    value
) {
    const nodes = [
        ...paragraphXml.matchAll(
            /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g
        )
    ];

    if (!nodes.length) {
        return paragraphXml;
    }

    let nameNode = -1;

    for (
        let i = 0;
        i < nodes.length;
        i++
    ) {
        if (
            /name\s*:/i.test(
                decodeXml(nodes[i][2])
            )
        ) {
            nameNode = i;
            break;
        }
    }

    if (nameNode === -1) {
        return paragraphXml;
    }

    let nodeIndex = 0;

    return paragraphXml.replace(
        /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
        (
            full,
            open,
            oldText,
            close
        ) => {
            const current =
                nodeIndex++;

            if (
                current < nameNode
            ) {
                return full;
            }

            if (
                current === nameNode
            ) {
                const decoded =
                    decodeXml(oldText);

                const match =
                    decoded.match(
                        /^(.*?name\s*:)\s*/i
                    );

                if (match) {
                    return (
                        open +
                        escapeXml(
                            match[1] +
                            " " +
                            value
                        ) +
                        close
                    );
                }

                return (
                    open +
                    escapeXml(value) +
                    close
                );
            }

            return (
                open +
                close
            );
        }
    );
}

function updateForm1Declarations(
    xml,
    inventors
) {
    const paragraphs = [
        ...xml.matchAll(
            /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
        )
    ];

    const texts =
        paragraphs.map(
            (m) =>
                getRunText(m[0])
                    .replace(
                        /\u00a0/g,
                        " "
                    )
                    .trim()
        );

    let start = -1;

    let end =
        paragraphs.length;

    for (
        let i = 0;
        i < texts.length;
        i++
    ) {
        const text =
            normalize(texts[i]);

        if (
            text.includes(
                "declarationbytheinventor"
            )
        ) {
            start = i;
        }

        if (
            start !== -1 &&
            text.includes(
                "declarationbytheapplicant(s)intheconventioncountry"
            )
        ) {
            end = i;
            break;
        }
    }

    if (start === -1) {
        return xml;
    }

    const nameIndexes = [];

    for (
        let i = start;
        i < end;
        i++
    ) {
        if (
            /name\s*:/i.test(
                texts[i]
            )
        ) {
            nameIndexes.push(i);
        }
    }

    const count = Math.min(
        inventors.length,
        nameIndexes.length
    );

    const remove =
        new Set();

    const replacements =
        new Map();

    /*
        Replace declaration names
        for entered inventors.
    */
    for (
        let i = 0;
        i < count;
        i++
    ) {
        replacements.set(
            nameIndexes[i],
            String(
                inventors[i]
                    .inventor_name ||
                ""
            ).trim()
        );
    }

    /*
        Remove unused declaration
        blocks completely.
    */
    for (
        let i = count;
        i < nameIndexes.length;
        i++
    ) {
        const nameIndex =
            nameIndexes[i];

        let blockStart =
            nameIndex;

        /*
            Find Date paragraph
            belonging to this inventor.
        */
        for (
            let p = nameIndex - 1;
            p >= start;
            p--
        ) {
            if (
                /date\s*:/i.test(
                    texts[p]
                )
            ) {
                blockStart = p;
                break;
            }
        }

        /*
            Remove Date,
            Signature,
            Name.
        */
        for (
            let p = blockStart;
            p <= nameIndex;
            p++
        ) {
            remove.add(p);
        }

        /*
            Remove blank paragraphs
            after Name.
        */
        for (
            let p = nameIndex + 1;
            p < end;
            p++
        ) {
            if (
                texts[p] === ""
            ) {
                remove.add(p);
            } else {
                break;
            }
        }
    }

    let index = 0;

    return xml.replace(
        /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,
        (paragraph) => {
            const current =
                index++;

            if (
                remove.has(current)
            ) {
                return "";
            }

            if (
                replacements.has(
                    current
                )
            ) {
                return replaceDeclarationName(
                    paragraph,
                    replacements.get(
                        current
                    )
                );
            }

            return paragraph;
        }
    );
}

function replaceAllRedRunsInParagraph(
    paragraphXml,
    value
) {
    let replaced = false;

    return paragraphXml.replace(
        /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g,
        (runXml) => {
            if (
                !isRedRun(runXml) ||
                !getRunText(runXml).trim()
            ) {
                return runXml;
            }

            if (!replaced) {
                replaced = true;

                return replaceRunText(
                    runXml,
                    value
                );
            }

            /*
                A field's red placeholder text
                (e.g. "Dr Viswanathan
                Balasubramanian") can be split
                across several runs. Once the new
                value has been placed in the first
                red run, every other red run in
                this paragraph must be cleared too,
                otherwise fragments of the old
                template text are left dangling
                next to the new value.
            */
            return replaceRunText(
                runXml,
                ""
            );
        }
    );
}

function updateForm5Inventors(
    xml,
    inventors
) {
    const enteredInventors = inventors.filter(
        (inventor) =>
            inventor &&
            String(
                inventor.inventor_name ||
                ""
            ).trim() !== "" &&
            String(
                inventor.inventor_address ||
                ""
            ).trim() !== ""
    );

    const tableMatch = xml.match(
        /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/
    );

    /*
        Safety fallback: if the table can't be
        found for some reason, leave the XML
        untouched rather than throwing.
    */
    if (!tableMatch) {
        return xml;
    }

    const tableXml = tableMatch[0];

    const rows = [
        ...tableXml.matchAll(
            /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g
        )
    ];

    /*
        Each inventor occupies its own table
        row, and that row's "NAME:" paragraph
        identifies it.
    */
    const isInventorRow = rows.map((row) => {
        const paras = [
            ...row[0].matchAll(
                /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
            )
        ];

        return paras.some((p) => {
            const text = normalize(
                getRunText(p[0])
            );

            return (
                text.includes("inventorsname") ||
                /^name:/.test(text)
            );
        });
    });

    let inventorIndex = 0;
    let rebuilt = "";

    for (
        let r = 0;
        r < rows.length;
        r++
    ) {
        const rowXml = rows[r][0];

        if (!isInventorRow[r]) {
            /*
                Header / applicant / closing
                signature rows - keep unchanged.
            */
            rebuilt += rowXml;

            continue;
        }

        const currentInventorIndex =
            inventorIndex++;

        if (
            currentInventorIndex >=
            enteredInventors.length
        ) {
            /*
                Unused inventor slot: drop the
                ENTIRE row (not just its text),
                otherwise an empty bordered row
                is left sitting in the table.
            */
            continue;
        }

        const inventor =
            enteredInventors[
                currentInventorIndex
            ];

        rebuilt +=
            rowXml.replace(
                /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,
                (paragraph) => {
                    const text = normalize(
                        getRunText(paragraph)
                    );

                    if (
                        text.includes("inventorsname") ||
                        /^name:/.test(text)
                    ) {
                        return replaceAllRedRunsInParagraph(
                            paragraph,
                            String(
                                inventor.inventor_name ||
                                ""
                            ).trim()
                        );
                    }

                    if (
                        text.includes("address:")
                    ) {
                        return replaceAllRedRunsInParagraph(
                            paragraph,
                            String(
                                inventor.inventor_address ||
                                ""
                            ).trim()
                        );
                    }

                    return paragraph;
                }
            );
    }

    /*
        Preserve the table's own opening tag,
        <w:tblPr> (borders/style) and <w:tblGrid>
        (column widths) - only the rows are
        being rebuilt.
    */
    const firstRowXml =
        rows[0][0];

    const tablePrefix =
        tableXml.slice(
            0,
            tableXml.indexOf(
                firstRowXml
            )
        );

    return xml.replace(
        tableXml,
        tablePrefix +
            rebuilt +
            "</w:tbl>"
    );
}

/* =========================================================
   MAIN XML UPDATE
   ========================================================= */

function updateXmlPart(
    xml,
    data,
    formName
) {
    const college =
        COLLEGES[
            Number(
                data.college_id
            )
        ];

    if (!college) {
        throw new Error(
            "Invalid college_id"
        );
    }

    const title =
        String(
            data.title || ""
        ).trim();

    const applicantName =
        String(
            data.applicant_name ||
            college.upper
        ).trim();

    const applicantAddress =
        String(
            data.applicant_address ||
            college.address
        ).trim();

    /*
        FORM 1's table / UI caps inventors
        at MAX_INVENTORS.
    */
    const inventors =
        Array.isArray(
            data.inventors
        )
            ? data.inventors.slice(
                  0,
                  MAX_INVENTORS
              )
            : [];

    const date =
        getDateParts(
            data.date
        );

    if (!title) {
        throw new Error(
            "Title is required"
        );
    }

    /*
        =====================================================
        FORM 1
        DIRECT INVENTOR TABLE UPDATE
        =====================================================
    */
    if (
        formName === "FORM 1"
    ) {
        xml =
            updateForm1InventorTable(
                xml,
                inventors
            );

        xml =
            updateForm1Declarations(
                xml,
                inventors
            );
    } else if (
        formName === "FORM 5"
    ) {
        xml =
            updateForm5Inventors(
                xml,
                inventors
            );
    } else {
        /*
            Other forms continue using
            the existing red-field logic.
        */
        OLD_INVENTORS.forEach(
            (
                oldInventor,
                index
            ) => {
                const inventor =
                    inventors[index];

                const newName =
                    inventor
                        ? String(
                              inventor.inventor_name ||
                              ""
                          ).trim()
                        : "";

                const newAddress =
                    inventor
                        ? String(
                              inventor.inventor_address ||
                              ""
                          ).trim()
                        : "";

                xml =
                    replaceAllRedText(
                        xml,
                        oldInventor.name,
                        newName
                    );

                xml =
                    replaceAllRedText(
                        xml,
                        oldInventor.address,
                        newAddress
                    );
            }
        );
    }

    /*
        College / Applicant Name
    */
    xml =
        replaceAllRedText(
            xml,
            "K.RAMAKRISHNAN COLLEGE OF ENGINEERING",
            applicantName
        );

    /*
        Applicant Address
    */
    xml =
        replaceAllRedText(
            xml,
            "NH-45, Samayapuram, Trichy, Tamil Nadu, India- 621112",
            applicantAddress
        );

    /*
        Title
    */
    xml =
        replaceAllRedText(
            xml,
            "A SMART TOILET SYSTEM",
            title
        );

    /*
        Long Date
    */
    xml =
        replaceAllRedText(
            xml,
            "3rd Day of July 2026",
            date.long
        );

    /*
        Short Date
    */
    xml =
        replaceAllRedText(
            xml,
            "03-07-2026",
            date.short
        );

    /*
        Year
    */
    xml =
        replaceAllRedText(
            xml,
            "2026",
            date.year
        );

    return convertRedFormattingToBlack(
        mergeOrphanPunctuationParagraphs(xml)
    );
}

/* =========================================================
   ORPHAN PUNCTUATION CLEANUP
   ========================================================= */

function appendTextToParagraph(
    paragraphXml,
    extraText
) {
    const newRun =
        `<w:r><w:t xml:space="preserve">${escapeXml(
            extraText
        )}</w:t></w:r>`;

    return paragraphXml.replace(
        /<\/w:p>$/,
        `${newRun}</w:p>`
    );
}

/*
    Some templates split a dynamic field's text
    across two paragraphs where trailing static
    punctuation (e.g. a comma) sits in its own
    non-red run right after the red text, in the
    same or a following paragraph - for example
    "COLLEGE OF" (red) / "ENGINEERING" (red) + ","
    (not red, kept as-is). Once the red text is
    replaced, that trailing punctuation is the
    only thing left in its paragraph and ends up
    stranded alone on its own line. This merges
    any paragraph that is now nothing but loose
    punctuation back onto the previous
    (non-blank) paragraph and removes it, so nothing
    is left floating on its own line.
*/
function mergeOrphanPunctuationParagraphs(xml) {
    const paragraphs = [
        ...xml.matchAll(
            /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
        )
    ];

    const texts = paragraphs.map(
        (m) => getRunText(m[0])
    );

    /*
        Never merge across a table cell boundary -
        only paragraphs that share the same cell
        (or are both outside any table) may merge.
    */
    const cells = [
        ...xml.matchAll(
            /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g
        )
    ];

    const cellRanges = cells.map((m) => [
        m.index,
        m.index + m[0].length
    ]);

    const cellIdOf = (paragraphIndex) => {
        const start =
            paragraphs[paragraphIndex].index;

        for (
            let c = 0;
            c < cellRanges.length;
            c++
        ) {
            const [start_, end_] =
                cellRanges[c];

            if (
                start >= start_ &&
                start < end_
            ) {
                return c;
            }
        }

        return -1;
    };

    const mergeInto = new Map();
    const remove = new Set();

    for (
        let i = 1;
        i < texts.length;
        i++
    ) {
        const current =
            texts[i].trim();

        const previous =
            texts[i - 1].trim();

        if (
            current !== "" &&
            /^[,;:.]+$/.test(current) &&
            previous !== "" &&
            !remove.has(i - 1) &&
            cellIdOf(i) === cellIdOf(i - 1)
        ) {
            mergeInto.set(
                i - 1,
                (mergeInto.get(i - 1) || "") +
                    texts[i]
            );

            remove.add(i);
        }
    }

    if (remove.size === 0) {
        return xml;
    }

    let index = 0;

    return xml.replace(
        /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,
        (paragraph) => {
            const current =
                index++;

            if (remove.has(current)) {
                return "";
            }

            if (
                mergeInto.has(current)
            ) {
                return appendTextToParagraph(
                    paragraph,
                    mergeInto.get(current)
                );
            }

            return paragraph;
        }
    );
}

function convertRedFormattingToBlack(xml) {
    return xml.replace(
        /(<w:color\b[^>]*\bw:val=["'])(?:FF0000|red)(["'][^>]*>)/gi,
        "$100000$2"
    );
}

/* =========================================================
   DOCX UPDATE
   ========================================================= */

function updateDocx(
    source,
    destination,
    data,
    formName
) {
    const zip =
        new PizZip(
            fs.readFileSync(
                source
            )
        );

    const xmlParts =
        Object.keys(
            zip.files
        ).filter(
            (filename) =>
                /^word\/(document|header|footer|footnotes|endnotes|comments).*\.xml$/i.test(
                    filename
                )
        );

    if (
        !xmlParts.includes(
            "word/document.xml"
        )
    ) {
        throw new Error(
            "document.xml not found"
        );
    }

    for (
        const filename of xmlParts
    ) {
        const xml =
            zip
                .file(filename)
                .asText();

        zip.file(
            filename,
            updateXmlPart(
                xml,
                data,
                formName
            )
        );
    }

    fs.mkdirSync(
        path.dirname(
            destination
        ),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        destination,
        zip.generate({
            type: "nodebuffer"
        })
    );
}

/* =========================================================
   FORM 9
   ========================================================= */

function getLibreOfficeCommand() {
    const candidates = [
        process.env.LIBREOFFICE_PATH,
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        "soffice",
        "libreoffice"
    ].filter(Boolean);

    for (
        const candidate of candidates
    ) {
        if (
            candidate ===
                "soffice" ||
            candidate ===
                "libreoffice" ||
            fs.existsSync(
                candidate
            )
        ) {
            return candidate;
        }
    }

    throw new Error(
        "LibreOffice is required for FORM 9."
    );
}

function prepareForm9() {
    fs.mkdirSync(
        TEMP_DIR,
        {
            recursive: true
        }
    );

    const source =
        path.join(
            DOCUMENTS_DIR,
            "FORM 9.doc"
        );

    const output =
        path.join(
            TEMP_DIR,
            "FORM 9.docx"
        );

    if (
        !fs.existsSync(
            source
        )
    ) {
        throw new Error(
            "FORM 9.doc is missing"
        );
    }

    /*
        FORM 9.doc never changes between
        requests, so the LibreOffice conversion
        (slow: it boots a whole LibreOffice
        process) only needs to run once. Reuse
        the cached .docx as long as it is not
        older than the source .doc.
    */
    if (
        fs.existsSync(
            output
        ) &&
        fs.statSync(output).mtimeMs >=
            fs.statSync(source).mtimeMs
    ) {
        return output;
    }

    execFileSync(
        getLibreOfficeCommand(),
        [
            "--headless",
            "--convert-to",
            "docx",
            "--outdir",
            TEMP_DIR,
            source
        ],
        {
            stdio: "ignore"
        }
    );

    if (
        !fs.existsSync(
            output
        )
    ) {
        throw new Error(
            "FORM 9 conversion failed"
        );
    }

    return output;
}

/* =========================================================
   GENERATE ALL DOCUMENTS
   ========================================================= */

const FORMS = [
    {
        name: "FORM 1",
        file: "Form 1.docx"
    },
    {
        name: "FORM 3",
        file: "FORM 3.docx"
    },
    {
        name: "FORM 5",
        file: "FORM 5.docx"
    },
    {
        name: "FORM 9",
        file: null
    },
    {
        name: "FORM 18",
        file: "FORM 18.docx"
    },
    {
        name: "FORM 28",
        file: "FORM 28.docx"
    }
];

/*
    The name a generated file is shown/downloaded
    as, matching the original document's own
    filename (FORM 9's original is a legacy .doc,
    but the generated version is always .docx).
    On disk, generated files still keep their
    "<FORM>_<applicationId>.docx" name so multiple
    applications never collide in the shared
    generated/ folder - this mapping is only for
    what the user sees/downloads.
*/
const FORM_DISPLAY_NAMES =
    Object.fromEntries(
        FORMS.map(
            (form) => [
                form.name,
                form.file ||
                    "FORM 9.docx"
            ]
        )
    );

function generateAll(
    data,
    applicationId
) {
    fs.mkdirSync(
        GENERATED_DIR,
        {
            recursive: true
        }
    );

    const results = [];

    for (
        const form of FORMS
    ) {
        let source;

        if (
            form.name ===
            "FORM 9"
        ) {
            source =
                prepareForm9();
        } else {
            source =
                path.join(
                    DOCUMENTS_DIR,
                    form.file
                );
        }

        if (
            !fs.existsSync(
                source
            )
        ) {
            throw new Error(
                `Original document missing: ${form.name}`
            );
        }

        const filename =
            `${form.name.replace(
                / /g,
                "_"
            )}_${applicationId}.docx`;

        const destination =
            path.join(
                GENERATED_DIR,
                filename
            );

        /*
            Important:
            form.name is passed here.
            This is what activates
            the special FORM 1 logic.
        */
        updateDocx(
            source,
            destination,
            data,
            form.name
        );

        results.push({
            form: form.name,
            filename,
            displayName:
                FORM_DISPLAY_NAMES[
                    form.name
                ],
            url:
                `/generated/${encodeURIComponent(
                    filename
                )}`
        });
    }

    return results;
}

module.exports = {
    generateAll,
    updateDocx,
    COLLEGES,
    MAX_INVENTORS,
    prepareForm9,
    FORM_DISPLAY_NAMES
};