const AUTH_STORAGE_KEY = "phi-lab-issue-tracker-session";
const API_BASE_URL = "https://phi-lab-server.vercel.app/api/v1/lab";

const state = {
    activeTab: "all",
    issues: [],
    searchQuery: ""
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
    if (!hasActiveSession()) {
        window.location.replace("./index.html");
        return;
    }

    cacheElements();
    bindEvents();
    loadIssues();
});

function cacheElements() {
    elements.grid = document.getElementById("issuesGrid");
    elements.loadingState = document.getElementById("loadingState");
    elements.feedbackState = document.getElementById("feedbackState");
    elements.summaryCount = document.getElementById("summaryCount");
    elements.summaryText = document.getElementById("summaryText");
    elements.openCount = document.getElementById("openCount");
    elements.closedCount = document.getElementById("closedCount");
    elements.tabButtons = Array.from(document.querySelectorAll(".tab-button"));
    elements.searchForm = document.getElementById("searchForm");
    elements.searchInput = document.getElementById("searchInput");
    elements.logoutButton = document.getElementById("logoutButton");
}

function bindEvents() {
    elements.tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const selectedTab = button.dataset.tab || "all";

            if (state.activeTab === selectedTab) {
                return;
            }

            state.activeTab = selectedTab;
            updateActiveTab();
            renderIssues();
        });
    });

    elements.searchForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        state.searchQuery = elements.searchInput?.value.trim().toLowerCase() || "";
        renderIssues();
    });

    elements.searchInput?.addEventListener("input", (event) => {
        const nextValue = event.target.value.trim().toLowerCase();

        if (!nextValue && state.searchQuery) {
            state.searchQuery = "";
            renderIssues();
        }
    });

    elements.logoutButton?.addEventListener("click", () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.location.replace("./index.html");
    });

    elements.feedbackState?.addEventListener("click", (event) => {
        const retryButton = event.target.closest("[data-action='retry']");

        if (retryButton) {
            loadIssues();
        }
    });
}

async function loadIssues() {
    setLoading(true);
    hideFeedback();

    try {
        const response = await fetch(`${API_BASE_URL}/issues`);

        if (!response.ok) {
            throw new Error("Unable to load issues.");
        }

        const payload = await response.json();
        state.issues = extractIssues(payload);
        updateActiveTab();
        renderIssues();
    } catch (error) {
        state.issues = [];
        elements.grid.innerHTML = "";
        showFeedback("Could not load issues", "Check the API connection and try again.", true);
    } finally {
        setLoading(false);
    }
}

function renderIssues() {
    const visibleIssues = getVisibleIssues();
    const totalIssues = state.issues.length;
    const openIssues = state.issues.filter((issue) => normalizeStatus(issue.status) === "open").length;
    const closedIssues = state.issues.filter((issue) => normalizeStatus(issue.status) === "closed").length;

    elements.summaryCount.textContent = `${visibleIssues.length} ${visibleIssues.length === 1 ? "Issue" : "Issues"}`;
    elements.summaryText.textContent = buildSummaryText(visibleIssues.length, totalIssues);
    elements.openCount.textContent = String(openIssues);
    elements.closedCount.textContent = String(closedIssues);

    if (!totalIssues) {
        elements.grid.innerHTML = "";
        showFeedback("No issues found", "The API returned an empty issue list.", false);
        return;
    }

    if (!visibleIssues.length) {
        elements.grid.innerHTML = "";
        showFeedback("No matching issues", "Try a different tab or clear the current search term.", false);
        return;
    }

    hideFeedback();
    elements.grid.innerHTML = visibleIssues.map((issue) => createIssueCard(issue)).join("");
}

function getVisibleIssues() {
    return state.issues.filter((issue) => {
        const issueStatus = normalizeStatus(issue.status);
        const matchesTab = state.activeTab === "all" ? true : issueStatus === state.activeTab;
        const matchesSearch = state.searchQuery ? issueMatchesSearch(issue, state.searchQuery) : true;

        return matchesTab && matchesSearch;
    });
}

function createIssueCard(issue) {
    const status = normalizeStatus(issue.status);
    const title = escapeHtml(issue.title || "Untitled issue");
    const description = escapeHtml(issue.description || "No description provided.");
    const author = escapeHtml(readPersonName(issue.author) || "Unknown");
    const priority = escapeHtml(issue.priority || "Not set");
    const createdAt = escapeHtml(formatDate(issue.createdAt));
    const labels = readLabels(issue.labels);
    const topClass = status === "closed" ? "closed" : "open";

    return `
        <article class="issue-card ${topClass}" tabindex="0" role="button" data-issue-id="${escapeAttribute(readIssueId(issue))}">
            <div class="issue-card-head">
                <span class="status-chip ${topClass}">${escapeHtml(topClass)}</span>
                <span class="priority-chip">${priority}</span>
            </div>

            <div class="issue-card-body">
                <h3>${title}</h3>
                <p class="issue-description">${description}</p>
            </div>

            <div class="issue-labels">
                ${labels.length ? labels.map((label) => `<span class="label-chip">${escapeHtml(label)}</span>`).join("") : '<span class="label-chip">General</span>'}
            </div>

            <div class="issue-card-footer">
                <div>
                    <span class="meta-label">Author</span>
                    <span class="meta-value">${author}</span>
                </div>
                <div>
                    <span class="meta-label">Created</span>
                    <span class="meta-value">${createdAt}</span>
                </div>
            </div>
        </article>
    `;
}

function buildSummaryText(visibleCount, totalCount) {
    const tabLabel = state.activeTab === "all" ? "all issues" : `${state.activeTab} issues`;

    if (!totalCount) {
        return "Track and manage your project issues.";
    }

    if (state.searchQuery) {
        return `Showing ${visibleCount} result${visibleCount === 1 ? "" : "s"} for "${state.searchQuery}" in ${tabLabel}.`;
    }

    if (state.activeTab === "all") {
        return "Track and manage your project issues.";
    }

    return `Showing ${visibleCount} of ${totalCount} issues in the ${tabLabel} view.`;
}

function issueMatchesSearch(issue, query) {
    const searchableValues = [
        issue.title,
        issue.description,
        issue.priority,
        readPersonName(issue.author),
        ...readLabels(issue.labels)
    ];

    return searchableValues
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
}

function setLoading(isLoading) {
    elements.loadingState.hidden = !isLoading;
}

function showFeedback(title, description, showRetryButton) {
    elements.feedbackState.hidden = false;
    elements.feedbackState.innerHTML = `
        <div class="feedback-copy">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
            ${showRetryButton ? '<button class="primary-button feedback-action" type="button" data-action="retry">Try Again</button>' : ""}
        </div>
    `;
}

function hideFeedback() {
    elements.feedbackState.hidden = true;
    elements.feedbackState.innerHTML = "";
}

function updateActiveTab() {
    elements.tabButtons.forEach((button) => {
        const isActive = button.dataset.tab === state.activeTab;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });
}

function extractIssues(payload) {
    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.data?.issues)) {
        return payload.data.issues;
    }

    return [];
}

function readLabels(labels) {
    if (!Array.isArray(labels)) {
        return [];
    }

    return labels
        .map((label) => {
            if (typeof label === "string") {
                return label;
            }

            if (label && typeof label === "object") {
                return label.name || label.label || "";
            }

            return "";
        })
        .filter(Boolean);
}

function readPersonName(person) {
    if (!person) {
        return "";
    }

    if (typeof person === "string") {
        return person;
    }

    return person.name || person.username || person.fullName || "";
}

function readIssueId(issue) {
    return issue?.id || issue?._id || issue?.issueId || "";
}

function normalizeStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();

    if (normalized === "closed") {
        return "closed";
    }

    return "open";
}

function formatDate(value) {
    if (!value) {
        return "Unknown";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#96;");
}

function hasActiveSession() {
    try {
        return Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
    } catch (error) {
        return false;
    }
}
