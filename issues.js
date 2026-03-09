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
    elements.searchButton = elements.searchForm?.querySelector("button[type='submit']");
    elements.modal = document.getElementById("issueModal");
    elements.modalContent = document.getElementById("modalContent");
    elements.modalLoading = document.getElementById("modalLoading");
    elements.modalCloseButton = document.getElementById("modalCloseButton");
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

    elements.searchForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nextQuery = elements.searchInput?.value.trim() || "";

        if (nextQuery === state.searchQuery && state.issues.length) {
            renderIssues();
            return;
        }

        await loadIssues(nextQuery);
    });

    elements.searchInput?.addEventListener("input", async (event) => {
        const nextValue = event.target.value.trim();

        if (!nextValue && state.searchQuery) {
            await loadIssues("");
        }
    });

    elements.logoutButton?.addEventListener("click", () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.location.replace("./index.html");
    });

    elements.feedbackState?.addEventListener("click", (event) => {
        const retryButton = event.target.closest("[data-action='retry']");

        if (retryButton) {
            loadIssues(state.searchQuery);
        }
    });

    elements.grid?.addEventListener("click", (event) => {
        const card = event.target.closest(".issue-card");

        if (card) {
            openIssueModal(card.dataset.issueId);
        }
    });

    elements.grid?.addEventListener("keydown", (event) => {
        const card = event.target.closest(".issue-card");

        if (!card) {
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openIssueModal(card.dataset.issueId);
        }
    });

    elements.modalCloseButton?.addEventListener("click", closeIssueModal);

    elements.modal?.addEventListener("click", (event) => {
        if (event.target === elements.modal) {
            closeIssueModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.modal && !elements.modal.hidden) {
            closeIssueModal();
        }
    });
}

async function loadIssues(query = state.searchQuery) {
    setLoading(true);
    hideFeedback();
    elements.grid.innerHTML = "";
    state.searchQuery = query.trim();

    if (elements.searchInput && elements.searchInput.value !== state.searchQuery) {
        elements.searchInput.value = state.searchQuery;
    }

    try {
        const endpoint = state.searchQuery
            ? `${API_BASE_URL}/issues/search?q=${encodeURIComponent(state.searchQuery)}`
            : `${API_BASE_URL}/issues`;
        const response = await fetch(endpoint);

        if (!response.ok) {
            throw new Error("Unable to load issues.");
        }

        const payload = await response.json();
        state.issues = extractIssues(payload);
        updateActiveTab();
        renderIssues();
    } catch (error) {
        state.issues = [];
        updateSummary(0, 0, 0);
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

    updateSummary(visibleIssues.length, openIssues, closedIssues, totalIssues);

    if (!totalIssues) {
        elements.grid.innerHTML = "";
        showFeedback(
            state.searchQuery ? "No matching issues" : "No issues found",
            state.searchQuery
                ? `No issues matched "${state.searchQuery}". Try another keyword.`
                : "The API returned an empty issue list.",
            false
        );
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

        return matchesTab;
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

function setLoading(isLoading) {
    elements.loadingState.hidden = !isLoading;

    if (elements.searchButton) {
        elements.searchButton.disabled = isLoading;
        elements.searchButton.textContent = isLoading ? "Loading..." : "Search";
    }
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

function updateSummary(visibleCount, openIssues, closedIssues, totalCount = state.issues.length) {
    elements.summaryCount.textContent = `${visibleCount} ${visibleCount === 1 ? "Issue" : "Issues"}`;
    elements.summaryText.textContent = buildSummaryText(visibleCount, totalCount);
    elements.openCount.textContent = String(openIssues);
    elements.closedCount.textContent = String(closedIssues);
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

async function openIssueModal(issueId) {
    if (!issueId || !elements.modal || !elements.modalContent || !elements.modalLoading) {
        return;
    }

    const fallbackIssue = state.issues.find((issue) => String(readIssueId(issue)) === String(issueId));

    elements.modal.hidden = false;
    elements.modalLoading.hidden = false;
    elements.modalContent.innerHTML = "";
    document.body.classList.add("modal-open");

    try {
        const response = await fetch(`${API_BASE_URL}/issue/${encodeURIComponent(issueId)}`);

        if (!response.ok) {
            throw new Error("Unable to load issue details.");
        }

        const payload = await response.json();
        const issue = payload?.data || fallbackIssue;

        if (!issue) {
            throw new Error("Issue details not found.");
        }

        renderIssueModal(issue, false);
    } catch (error) {
        if (fallbackIssue) {
            renderIssueModal(fallbackIssue, true);
        } else {
            elements.modalContent.innerHTML = `
                <div class="feedback-copy">
                    <h3>Could not load issue details</h3>
                    <p>Try closing the modal and opening the card again.</p>
                </div>
            `;
        }
    } finally {
        elements.modalLoading.hidden = true;
    }
}

function renderIssueModal(issue, isFallback) {
    const status = normalizeStatus(issue.status);
    const labels = readLabels(issue.labels);
    const title = escapeHtml(issue.title || "Untitled issue");
    const description = escapeHtml(issue.description || "No description provided.");
    const author = escapeHtml(readPersonName(issue.author) || "Unknown");
    const assignee = escapeHtml(readPersonName(issue.assignee) || readPersonName(issue.author) || "Unassigned");
    const priority = escapeHtml(issue.priority || "Not set");
    const createdAt = escapeHtml(formatDate(issue.createdAt));
    const issueId = escapeHtml(readIssueId(issue) || "Unknown");

    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h2 id="modalTitle">${title}</h2>
            <div class="modal-meta">
                <span class="status-chip ${status}">${escapeHtml(status)}</span>
                <span>Opened by ${author}</span>
                <span>&bull;</span>
                <span>${createdAt}</span>
            </div>
        </div>

        <div class="modal-labels">
            ${labels.length ? labels.map((label) => `<span class="label-chip">${escapeHtml(label)}</span>`).join("") : '<span class="label-chip">General</span>'}
        </div>

        <p class="modal-description">${description}</p>

        <div class="modal-detail-grid">
            <article class="detail-card">
                <span class="detail-label">Assignee</span>
                <span class="detail-value">${assignee}</span>
            </article>
            <article class="detail-card">
                <span class="detail-label">Priority</span>
                <span class="detail-value"><span class="priority-chip">${priority}</span></span>
            </article>
            <article class="detail-card">
                <span class="detail-label">Status</span>
                <span class="detail-value">${escapeHtml(status)}</span>
            </article>
            <article class="detail-card">
                <span class="detail-label">Issue ID</span>
                <span class="detail-value">#${issueId}</span>
            </article>
        </div>

        ${isFallback ? '<p class="modal-fallback-note">Showing the card data because the single-issue request could not be completed.</p>' : ""}

        <div class="modal-actions">
            <button class="primary-button" type="button" data-action="close-modal">Close</button>
        </div>
    `;

    const closeButton = elements.modalContent.querySelector("[data-action='close-modal']");

    closeButton?.addEventListener("click", closeIssueModal);
}

function closeIssueModal() {
    if (!elements.modal || !elements.modalContent || !elements.modalLoading) {
        return;
    }

    elements.modal.hidden = true;
    elements.modalContent.innerHTML = "";
    elements.modalLoading.hidden = true;
    document.body.classList.remove("modal-open");
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
