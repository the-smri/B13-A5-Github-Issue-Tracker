const AUTH_STORAGE_KEY = "phi-lab-issue-tracker-session";
const API_BASE_URL = "https://phi-lab-server.vercel.app/api/v1/lab";
const REQUEST_TIMEOUT_MS = 12000;

const PRIMARY_BUTTON_CLASSES = "inline-flex min-h-[54px] items-center justify-center rounded-2xl bg-gradient-to-r from-brand to-[#6f43ff] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/25 focus:outline-none focus:ring-4 focus:ring-brand/15 disabled:cursor-wait disabled:opacity-70 disabled:shadow-none";
const TAB_BASE_CLASSES = "tab-button inline-flex min-h-11 min-w-[92px] items-center justify-center rounded-xl border px-5 text-sm font-bold transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-brand/15";
const TAB_ACTIVE_CLASSES = "is-active border-transparent bg-brand text-white shadow-lg shadow-brand/20";
const TAB_INACTIVE_CLASSES = "border-slate-200 bg-white text-slate-500";

const state = {
    activeTab: "all",
    issues: [],
    searchQuery: ""
};

const elements = {};

document.addEventListener("DOMContentLoaded", function () {
    if (!hasActiveSession()) {
        window.location.replace("./index.html");
        return;
    }

    cacheElements();
    bindEvents();
    updateActiveTab();
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
    elements.modal = document.getElementById("issueModal");
    elements.modalContent = document.getElementById("modalContent");
    elements.modalLoading = document.getElementById("modalLoading");
    elements.modalCloseButton = document.getElementById("modalCloseButton");

    if (elements.searchForm) {
        elements.searchButton = elements.searchForm.querySelector("button[type='submit']");
    } else {
        elements.searchButton = null;
    }
}

function bindEvents() {
    for (let i = 0; i < elements.tabButtons.length; i += 1) {
        const button = elements.tabButtons[i];

        button.addEventListener("click", function () {
            const selectedTab = button.dataset.tab || "all";

            if (state.activeTab === selectedTab) {
                return;
            }

            state.activeTab = selectedTab;
            updateActiveTab();
            renderIssues();
        });
    }

    if (elements.searchForm) {
        elements.searchForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            let nextQuery = "";

            if (elements.searchInput) {
                nextQuery = elements.searchInput.value.trim();
            }

            if (nextQuery === state.searchQuery && state.issues.length > 0) {
                renderIssues();
                return;
            }

            await loadIssues(nextQuery);
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", async function (event) {
            const nextValue = event.target.value.trim();

            if (nextValue === "" && state.searchQuery !== "") {
                await loadIssues("");
            }
        });
    }

    if (elements.logoutButton) {
        elements.logoutButton.addEventListener("click", function () {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            window.location.replace("./index.html");
        });
    }

    if (elements.feedbackState) {
        elements.feedbackState.addEventListener("click", function (event) {
            const retryButton = event.target.closest("[data-action='retry']");

            if (retryButton) {
                loadIssues(state.searchQuery);
            }
        });
    }

    if (elements.grid) {
        elements.grid.addEventListener("click", function (event) {
            const card = event.target.closest(".issue-card");

            if (card) {
                openIssueModal(card.dataset.issueId);
            }
        });

        elements.grid.addEventListener("keydown", function (event) {
            const card = event.target.closest(".issue-card");

            if (!card) {
                return;
            }

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openIssueModal(card.dataset.issueId);
            }
        });
    }

    if (elements.modalCloseButton) {
        elements.modalCloseButton.addEventListener("click", closeIssueModal);
    }

    if (elements.modal) {
        elements.modal.addEventListener("click", function (event) {
            if (event.target === elements.modal) {
                closeIssueModal();
            }
        });
    }

    document.addEventListener("keydown", function (event) {
        const modalIsOpen = elements.modal && !elements.modal.classList.contains("hidden");

        if (event.key === "Escape" && modalIsOpen) {
            closeIssueModal();
        }
    });
}

async function loadIssues(query) {
    let nextQuery = state.searchQuery;

    if (typeof query === "string") {
        nextQuery = query.trim();
    }

    setLoading(true);
    hideFeedback();

    if (elements.grid) {
        elements.grid.innerHTML = "";
    }

    state.searchQuery = nextQuery;

    if (elements.searchInput && elements.searchInput.value !== state.searchQuery) {
        elements.searchInput.value = state.searchQuery;
    }

    try {
        let endpoint = `${API_BASE_URL}/issues`;

        if (state.searchQuery !== "") {
            endpoint = `${API_BASE_URL}/issues/search?q=${encodeURIComponent(state.searchQuery)}`;
        }

        const payload = await fetchJsonWithTimeout(endpoint, "Unable to load issues.");
        state.issues = extractIssues(payload);
        updateActiveTab();
        renderIssues();
    } catch (error) {
        state.issues = [];
        updateSummary(0, 0, 0);

        if (elements.grid) {
            elements.grid.innerHTML = "";
        }

        showFeedback("Could not load issues", getRequestErrorMessage(error, true), true);
    } finally {
        setLoading(false);
    }
}

function renderIssues() {
    const visibleIssues = getVisibleIssues();
    const totalIssues = state.issues.length;
    let openIssues = 0;
    let closedIssues = 0;

    for (let i = 0; i < state.issues.length; i += 1) {
        const issue = state.issues[i];
        const status = normalizeStatus(readIssueStatus(issue));

        if (status === "closed") {
            closedIssues += 1;
        } else {
            openIssues += 1;
        }
    }

    updateSummary(visibleIssues.length, openIssues, closedIssues, totalIssues);

    if (totalIssues === 0) {
        if (elements.grid) {
            elements.grid.innerHTML = "";
        }

        if (state.searchQuery !== "") {
            showFeedback("No matching issues", `No issues matched "${state.searchQuery}". Try another keyword.`, false);
        } else {
            showFeedback("No issues found", "The API returned an empty issue list.", false);
        }

        return;
    }

    if (visibleIssues.length === 0) {
        if (elements.grid) {
            elements.grid.innerHTML = "";
        }

        showFeedback("No matching issues", "Try a different tab or clear the current search term.", false);
        return;
    }

    hideFeedback();

    let cardsHtml = "";

    for (let i = 0; i < visibleIssues.length; i += 1) {
        cardsHtml += createIssueCard(visibleIssues[i]);
    }

    if (elements.grid) {
        elements.grid.innerHTML = cardsHtml;
    }
}

function getVisibleIssues() {
    const visibleIssues = [];

    for (let i = 0; i < state.issues.length; i += 1) {
        const issue = state.issues[i];
        const issueStatus = normalizeStatus(readIssueStatus(issue));

        if (state.activeTab === "all" || issueStatus === state.activeTab) {
            visibleIssues.push(issue);
        }
    }

    return visibleIssues;
}

function createIssueCard(issue) {
    const status = normalizeStatus(readIssueStatus(issue));
    const title = escapeHtml(issue.title || "Untitled issue");
    const description = escapeHtml(issue.description || "No description provided.");
    const author = escapeHtml(readPersonName(issue.author) || "Unknown");
    const priority = escapeHtml(readIssuePriority(issue));
    const createdAt = escapeHtml(formatDate(readIssueCreatedAt(issue)));
    const labels = readLabels(issue.labels);
    let cardBorderClass = "border-t-emerald-500";

    if (status === "closed") {
        cardBorderClass = "border-t-violet-500";
    }

    const statusChipClass = getStatusChipClass(status);
    let labelsHtml = "";

    if (labels.length === 0) {
        labelsHtml = '<span class="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-amber-700">General</span>';
    } else {
        for (let i = 0; i < labels.length; i += 1) {
            labelsHtml += `<span class="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-amber-700">${escapeHtml(labels[i])}</span>`;
        }
    }

    return `
        <article class="issue-card ${cardBorderClass} cursor-pointer rounded-3xl border border-slate-200 border-t-4 bg-white/95 p-[18px] pb-5 shadow-lg shadow-slate-900/5 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 focus-visible:-translate-y-1 focus-visible:shadow-xl focus-visible:shadow-slate-900/10 focus-visible:outline-none" tabindex="0" role="button" data-issue-id="${escapeAttribute(readIssueId(issue))}">
            <div class="mb-3 flex items-center justify-between gap-3">
                <span class="${statusChipClass}">${escapeHtml(status)}</span>
                <span class="inline-flex items-center justify-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-rose-500">${priority}</span>
            </div>

            <div>
                <h3 class="mb-2 text-[1.02rem] font-bold leading-6 text-slate-900">${title}</h3>
                <p class="min-h-[72px] overflow-hidden text-sm leading-6 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">${description}</p>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
                ${labelsHtml}
            </div>

            <div class="mt-[18px] flex items-start justify-between gap-3 border-t border-slate-200 pt-[14px]">
                <div>
                    <span class="mb-1 block text-[0.76rem] font-bold uppercase tracking-[0.08em] text-slate-400">Author</span>
                    <span class="block font-semibold text-slate-900">${author}</span>
                </div>
                <div>
                    <span class="mb-1 block text-[0.76rem] font-bold uppercase tracking-[0.08em] text-slate-400">Created</span>
                    <span class="block font-semibold text-slate-900">${createdAt}</span>
                </div>
            </div>
        </article>
    `;
}

function buildSummaryText(visibleCount, totalCount) {
    let tabLabel = "all issues";

    if (state.activeTab !== "all") {
        tabLabel = `${state.activeTab} issues`;
    }

    if (totalCount === 0) {
        return "Track and manage your project issues.";
    }

    if (state.searchQuery !== "") {
        if (visibleCount === 1) {
            return `Showing 1 result for "${state.searchQuery}" in ${tabLabel}.`;
        }

        return `Showing ${visibleCount} results for "${state.searchQuery}" in ${tabLabel}.`;
    }

    if (state.activeTab === "all") {
        return "Track and manage your project issues.";
    }

    return `Showing ${visibleCount} of ${totalCount} issues in the ${tabLabel} view.`;
}

function setLoading(isLoading) {
    setVisibility(elements.loadingState, isLoading, ["grid", "place-items-center", "gap-[14px]"]);

    if (elements.searchButton) {
        elements.searchButton.disabled = isLoading;

        if (isLoading) {
            elements.searchButton.textContent = "Loading...";
        } else {
            elements.searchButton.textContent = "Search";
        }
    }
}

function showFeedback(title, description, showRetryButton) {
    setVisibility(elements.feedbackState, true);

    let buttonHtml = "";

    if (showRetryButton) {
        buttonHtml = `<button class="${PRIMARY_BUTTON_CLASSES}" type="button" data-action="retry">Try Again</button>`;
    }

    elements.feedbackState.innerHTML = `
        <div class="mx-auto max-w-xl">
            <h3 class="mb-2 text-xl font-bold text-slate-900">${escapeHtml(title)}</h3>
            <p class="mb-5 text-slate-500">${escapeHtml(description)}</p>
            ${buttonHtml}
        </div>
    `;
}

function hideFeedback() {
    setVisibility(elements.feedbackState, false);
    elements.feedbackState.innerHTML = "";
}

function updateSummary(visibleCount, openIssues, closedIssues, totalCount) {
    let finalTotalCount = totalCount;

    if (typeof finalTotalCount !== "number") {
        finalTotalCount = state.issues.length;
    }

    let countText = "Issues";

    if (visibleCount === 1) {
        countText = "Issue";
    }

    elements.summaryCount.textContent = `${visibleCount} ${countText}`;
    elements.summaryText.textContent = buildSummaryText(visibleCount, finalTotalCount);
    elements.openCount.textContent = String(openIssues);
    elements.closedCount.textContent = String(closedIssues);
}

function updateActiveTab() {
    for (let i = 0; i < elements.tabButtons.length; i += 1) {
        const button = elements.tabButtons[i];
        const buttonTab = button.dataset.tab;
        let classText = `${TAB_BASE_CLASSES} ${TAB_INACTIVE_CLASSES}`;
        let isActive = false;

        if (buttonTab === state.activeTab) {
            classText = `${TAB_BASE_CLASSES} ${TAB_ACTIVE_CLASSES}`;
            isActive = true;
        }

        button.className = classText;
        button.setAttribute("aria-selected", String(isActive));
    }
}

function extractIssues(payload) {
    if (payload && Array.isArray(payload.data)) {
        return payload.data;
    }

    if (payload && payload.data && Array.isArray(payload.data.issues)) {
        return payload.data.issues;
    }

    return [];
}

async function openIssueModal(issueId) {
    if (!issueId) {
        return;
    }

    if (!elements.modal || !elements.modalContent || !elements.modalLoading) {
        return;
    }

    let fallbackIssue = null;

    for (let i = 0; i < state.issues.length; i += 1) {
        const issue = state.issues[i];

        if (String(readIssueId(issue)) === String(issueId)) {
            fallbackIssue = issue;
            break;
        }
    }

    setVisibility(elements.modal, true, ["grid", "place-items-center"]);
    setVisibility(elements.modalLoading, true, ["grid", "place-items-center", "gap-[14px]"]);
    elements.modalContent.innerHTML = "";
    document.body.classList.add("overflow-hidden");

    try {
        const payload = await fetchJsonWithTimeout(
            `${API_BASE_URL}/issue/${encodeURIComponent(issueId)}`,
            "Unable to load issue details."
        );

        let issue = fallbackIssue;

        if (payload && payload.data) {
            issue = payload.data;
        }

        if (!issue) {
            throw new Error("Issue details not found.");
        }

        renderIssueModal(issue, false);
    } catch (error) {
        if (fallbackIssue) {
            renderIssueModal(fallbackIssue, true);
        } else {
            elements.modalContent.innerHTML = `
                <div class="mx-auto max-w-xl">
                    <h3 class="mb-2 text-xl font-bold text-slate-900">Could not load issue details</h3>
                    <p class="mb-5 text-slate-500">${escapeHtml(getRequestErrorMessage(error, false))}</p>
                    <button class="${PRIMARY_BUTTON_CLASSES}" type="button" data-action="close-modal">Close</button>
                </div>
            `;

            const closeButton = elements.modalContent.querySelector("[data-action='close-modal']");

            if (closeButton) {
                closeButton.addEventListener("click", closeIssueModal);
            }
        }
    } finally {
        setVisibility(elements.modalLoading, false);
    }
}

function renderIssueModal(issue, isFallback) {
    const status = normalizeStatus(readIssueStatus(issue));
    const labels = readLabels(issue.labels);
    const title = escapeHtml(issue.title || "Untitled issue");
    const description = escapeHtml(issue.description || "No description provided.");
    const author = escapeHtml(readPersonName(issue.author) || "Unknown");
    const assignee = escapeHtml(readPersonName(issue.assignee) || readPersonName(issue.author) || "Unassigned");
    const priority = escapeHtml(readIssuePriority(issue));
    const createdAt = escapeHtml(formatDate(readIssueCreatedAt(issue)));
    const updatedAt = escapeHtml(formatDate(readIssueUpdatedAt(issue)));
    const issueId = escapeHtml(readIssueId(issue) || "Unknown");
    const statusChipClass = getStatusChipClass(status);

    let labelsHtml = "";

    if (labels.length === 0) {
        labelsHtml = '<span class="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-amber-700">General</span>';
    } else {
        for (let i = 0; i < labels.length; i += 1) {
            labelsHtml += `<span class="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-amber-700">${escapeHtml(labels[i])}</span>`;
        }
    }

    let fallbackText = "";

    if (isFallback) {
        fallbackText = '<p class="mt-5 text-slate-500">Showing the card data because the single-issue request could not be completed.</p>';
    }

    elements.modalContent.innerHTML = `
        <div>
            <div class="mb-6">
                <h2 id="modalTitle" class="mb-3 text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold leading-[1.12] text-slate-900">${title}</h2>
                <div class="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
                    <span class="${statusChipClass}">${escapeHtml(status)}</span>
                    <span>Opened by ${author}</span>
                    <span>&bull;</span>
                    <span>${createdAt}</span>
                </div>
            </div>

            <div class="mb-[26px] flex flex-wrap gap-2.5">
                ${labelsHtml}
            </div>

            <p class="text-lg leading-8 text-slate-500 sm:text-[1.28rem]">${description}</p>

            <div class="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                ${createDetailCard("Author", author)}
                ${createDetailCard("Assignee", assignee)}
                ${createDetailCard("Priority", `<span class="inline-flex items-center justify-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-rose-500">${priority}</span>`)}
                ${createDetailCard("Status", escapeHtml(status))}
                ${createDetailCard("Created At", createdAt)}
                ${createDetailCard("Updated At", updatedAt)}
                ${createDetailCard("Issue ID", `#${issueId}`)}
            </div>

            ${fallbackText}

            <div class="mt-7 flex justify-end">
                <button class="${PRIMARY_BUTTON_CLASSES}" type="button" data-action="close-modal">Close</button>
            </div>
        </div>
    `;

    const closeButton = elements.modalContent.querySelector("[data-action='close-modal']");

    if (closeButton) {
        closeButton.addEventListener("click", closeIssueModal);
    }
}

function closeIssueModal() {
    if (!elements.modal || !elements.modalContent || !elements.modalLoading) {
        return;
    }

    setVisibility(elements.modal, false);
    elements.modalContent.innerHTML = "";
    setVisibility(elements.modalLoading, false);
    document.body.classList.remove("overflow-hidden");
}

function createDetailCard(label, value) {
    return `
        <article class="rounded-3xl bg-slate-50 p-5">
            <span class="mb-2.5 block text-slate-500">${label}</span>
            <span class="block text-lg font-bold text-slate-900">${value}</span>
        </article>
    `;
}

function getStatusChipClass(status) {
    if (status === "closed") {
        return "inline-flex items-center justify-center rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-violet-700";
    }

    return "inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-emerald-700";
}

function readLabels(labels) {
    if (!Array.isArray(labels)) {
        return [];
    }

    const labelList = [];

    for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];

        if (typeof label === "string" && label !== "") {
            labelList.push(label);
        } else if (label && typeof label === "object") {
            if (label.name) {
                labelList.push(label.name);
            } else if (label.label) {
                labelList.push(label.label);
            }
        }
    }

    return labelList;
}

function readPersonName(person) {
    if (!person) {
        return "";
    }

    if (typeof person === "string") {
        return person;
    }

    if (person.name) {
        return person.name;
    }

    if (person.username) {
        return person.username;
    }

    if (person.fullName) {
        return person.fullName;
    }

    return "";
}

function readIssueId(issue) {
    if (!issue) {
        return "";
    }

    return issue.id || issue._id || issue.issueId || "";
}

function readIssueStatus(issue) {
    if (!issue) {
        return "";
    }

    return issue.status || issue.category || issue.state || "";
}

function readIssuePriority(issue) {
    if (!issue) {
        return "Not set";
    }

    return issue.priority || issue.severity || "Not set";
}

function readIssueCreatedAt(issue) {
    if (!issue) {
        return "";
    }

    return issue.createdAt || issue.created_at || issue.dateCreated || "";
}

function readIssueUpdatedAt(issue) {
    if (!issue) {
        return "";
    }

    return issue.updatedAt || issue.updated_at || issue.lastUpdated || readIssueCreatedAt(issue);
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
        const session = localStorage.getItem(AUTH_STORAGE_KEY);
        return Boolean(session);
    } catch (error) {
        return false;
    }
}

function setVisibility(element, shouldShow, displayClasses) {
    if (!element) {
        return;
    }

    const classesToShow = displayClasses || [];

    if (shouldShow) {
        element.classList.remove("hidden");
    } else {
        element.classList.add("hidden");
    }

    for (let i = 0; i < classesToShow.length; i += 1) {
        const className = classesToShow[i];

        if (shouldShow) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    element.setAttribute("aria-hidden", String(!shouldShow));
}

async function fetchJsonWithTimeout(url, fallbackMessage) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(function () {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(fallbackMessage);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The request timed out.");
        }

        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function getRequestErrorMessage(error, isPageLoad) {
    let protocolHint = "";

    if (window.location.protocol === "file:") {
        protocolHint = " Open the project with Live Server or another local server instead of opening the HTML file directly.";
    }

    if (error && error.message === "The request timed out.") {
        return `The server took too long to respond.${protocolHint}`;
    }

    if (isPageLoad) {
        return `Check the API connection and try again.${protocolHint}`;
    }

    return `Try closing the modal and opening the card again.${protocolHint}`;
}
