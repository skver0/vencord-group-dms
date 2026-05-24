import definePlugin from "@utils/types";

const STYLE_ID = "vencord-group-dms-style";
const TAB_ID = "vc-group-dms-tab";
const STATUS_CLASS = "vc-group-dms-status";
const OPEN_CLASS = "vc-group-dms-open";

function getRoot() {
    return document.querySelector(".privateChannels_e6b769");
}

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.privateChannels_e6b769 li.channel__972a0.dm__972a0:has(a[aria-label*="group message"]),
.privateChannels_e6b769 li.channel__972a0.dm__972a0:has([src*="channel-icons"]) {
  max-height: 0 !important;
  opacity: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  pointer-events: none !important;
  transition: max-height 0.25s ease, opacity 0.2s ease;
}

.privateChannels_e6b769.${OPEN_CLASS} li.channel__972a0.dm__972a0:has(a[aria-label*="group message"]),
.privateChannels_e6b769.${OPEN_CLASS} li.channel__972a0.dm__972a0:has([src*="channel-icons"]) {
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

    document.head.appendChild(style);
}

function updateTabState(tab: HTMLElement, open: boolean) {
    tab.classList.toggle("active", open);

    const status = tab.querySelector(`.${STATUS_CLASS}`);
    if (status) status.textContent = open ? "(open)" : "(hidden)";
}

function ensureGroupTab() {
    const root = getRoot();
    if (!root) return;

    const tabs = Array.from(document.querySelectorAll<HTMLElement>("[role='tablist']"));
    const tablist = tabs.find(tab => {
        const text = tab.textContent ?? "";
        return /Friends/i.test(text) && /Pending|Blocked|Add Friend/i.test(text);
    });

    if (!tablist) return;
    if (tablist.querySelector(`#${TAB_ID}`)) return;

    const tab = document.createElement("div");
    tab.id = TAB_ID;
    tab.className = "vc-group-dms-tab";
    tab.setAttribute("role", "tab");
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
        updateTabState(tab, next);
    };

    tab.addEventListener("click", e => {
        e.stopPropagation();
        toggle();
    });

    tab.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
        }
    });

    tablist.appendChild(tab);
    updateTabState(tab, root.classList.contains(OPEN_CLASS));
}

let observer: MutationObserver | null = null;

function startObservers() {
    if (observer) return;

    observer = new MutationObserver(() => {
        ensureGroupTab();

        const root = getRoot();
        if (!root) return;

        const status = document.querySelector<HTMLElement>(`#${TAB_ID} .${STATUS_CLASS}`);
        if (status) status.textContent = root.classList.contains(OPEN_CLASS) ? "(open)" : "(hidden)";
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObservers() {
    observer?.disconnect();
    observer = null;
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(TAB_ID)?.remove();
    getRoot()?.classList.remove(OPEN_CLASS);
}

export default definePlugin({
    name: "Group DMs Tab",
    description: "Adds a Groups tab to Friends that toggles group DM visibility.",
    authors: [{ name: "skver", id: 212558627016409088n }],
    start() {
        injectStyle();
        ensureGroupTab();
        startObservers();
    },
    stop() {
        stopObservers();
    }
});