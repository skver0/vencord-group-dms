import { Logger } from "@utils/Logger";
import definePlugin, { StartAt } from "@utils/types";

const logger = new Logger("Group DMs Tab");

const TAB_ID = "vc-group-dms-tab";
const STATUS_CLASS = "vc-group-dms-status";
const OPEN_CLASS = "vc-group-dms-open";
const PRIVATE_CHANNELS_SELECTOR = ".privateChannels_e6b769";

const managedStyle = `
${PRIVATE_CHANNELS_SELECTOR} li.channel__972a0.dm__972a0:has(a[aria-label*="group message"]),
${PRIVATE_CHANNELS_SELECTOR} li.channel__972a0.dm__972a0:has([src*="channel-icons"]) {
    max-height: 0 !important;
    opacity: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    pointer-events: none !important;
    transition: max-height 0.25s ease, opacity 0.2s ease;
}

${PRIVATE_CHANNELS_SELECTOR}.${OPEN_CLASS} li.channel__972a0.dm__972a0:has(a[aria-label*="group message"]),
${PRIVATE_CHANNELS_SELECTOR}.${OPEN_CLASS} li.channel__972a0.dm__972a0:has([src*="channel-icons"]) {
    max-height: 48px !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    margin: 6px 0 !important;
    padding: 0 6px !important;
}

.vc-group-dms-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 6px;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--channels-default);
    font-size: 13px;
    line-height: 1;
    user-select: none;
}

.vc-group-dms-tab.active {
    background: color-mix(in srgb, var(--background-primary) 80%, var(--brand-500) 20%);
    color: var(--text-normal);
}

.${STATUS_CLASS} {
    font-size: 11px;
    opacity: 0.85;
}
`;

let observer: MutationObserver | null = null;

function getRoot() {
    return document.querySelector<HTMLElement>(PRIVATE_CHANNELS_SELECTOR);
}

function getTablist() {
    const tablists = Array.from(document.querySelectorAll<HTMLElement>("[role='tablist']"));

    return tablists.find(tablist => {
        const text = tablist.textContent ?? "";
        return /Friends/i.test(text) && /Pending|Blocked|Add Friend/i.test(text);
    });
}

function updateTabState(tab: HTMLElement, open: boolean) {
    tab.classList.toggle("active", open);

    const status = tab.querySelector<HTMLElement>(`.${STATUS_CLASS}`);
    if (status) status.textContent = open ? "(open)" : "(hidden)";
}

function ensureGroupTab() {
    const root = getRoot();
    const tablist = getTablist();

    if (!root || !tablist) return;
    if (tablist.querySelector(`#${TAB_ID}`)) return;

    const tab = document.createElement("div");
    tab.id = TAB_ID;
    tab.className = "vc-group-dms-tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(root.classList.contains(OPEN_CLASS)));
    tab.tabIndex = 0;

    const label = document.createElement("span");
    label.textContent = "Groups";

    const status = document.createElement("span");
    status.className = STATUS_CLASS;
    status.textContent = "(hidden)";

    tab.append(label, status);

    const toggle = () => {
        const next = !root.classList.contains(OPEN_CLASS);
        root.classList.toggle(OPEN_CLASS, next);
        tab.setAttribute("aria-selected", String(next));
        updateTabState(tab, next);
    };

    tab.addEventListener("click", event => {
        event.stopPropagation();
        toggle();
    });

    tab.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
        }
    });

    tablist.appendChild(tab);
    updateTabState(tab, root.classList.contains(OPEN_CLASS));
}

function syncGroupVisibility() {
    const root = getRoot();
    const tab = document.getElementById(TAB_ID);

    if (!root || !tab) return;

    updateTabState(tab, root.classList.contains(OPEN_CLASS));
}

function startObservers() {
    if (observer) return;

    observer = new MutationObserver(() => {
        ensureGroupTab();
        syncGroupVisibility();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObservers() {
    observer?.disconnect();
    observer = null;
    document.getElementById(TAB_ID)?.remove();
    getRoot()?.classList.remove(OPEN_CLASS);
}

export default definePlugin({
    name: "GroupDMs",
    description: "Adds a Groups tab to Friends that toggles group DM visibility.",
    authors: [{ name: "skver", id: 212558627016409088n }],
    tags: ["Friends", "Utility"],
    searchTerms: ["group dms", "group dm", "private channels"],
    startAt: StartAt.DOMContentLoaded,
    managedStyle,
    start() {
        try {
            ensureGroupTab();
            startObservers();
        } catch (error) {
            logger.error("Failed to start plugin:", error);
        }
    },
    stop() {
        try {
            stopObservers();
        } catch (error) {
            logger.error("Failed to stop plugin:", error);
        }
    }
});
