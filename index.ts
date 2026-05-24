import "./style.css";

import { Logger } from "@utils/Logger";
import definePlugin, { StartAt } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";

const logger = new Logger("Group DMs Tab");

const PANEL_ID = "vc-group-dms-panel";
const GROUP_MESSAGES_SECTION_ID = "vc-group-dms-group-messages";
const PRIVATE_CHANNELS_SELECTOR = ".privateChannels_e6b769";
const COLLAPSED_DIRECT_CLASS = "vc-group-dms-hide-direct";
const COLLAPSED_GROUPS_CLASS = "vc-group-dms-hide-groups";

const ChannelStore = findStoreLazy("getSortedPrivateChannels");
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");
const UserStore = findByPropsLazy("getCurrentUser", "getUser");
const IconUtils = findByPropsLazy("getChannelIconURL");

let observer: MutationObserver | null = null;

function getRoot() {
    return document.querySelector<HTMLElement>(PRIVATE_CHANNELS_SELECTOR);
}

function isGroupDM(channel: any) {
    return typeof channel?.isGroupDM === "function" ? channel.isGroupDM() : Boolean(channel?.isGroupDM);
}

function getGroupDMName(channel: any) {
    if (channel?.name) return channel.name as string;

    return (channel?.recipients ?? [])
        .map((userId: string) => UserStore.getUser?.(userId))
        .filter(Boolean)
        .map((user: any) => user?.global_name || user?.globalName || user?.username || user?.displayName || user?.id || "Unknown")
        .join(", ");
}

function getGroupDMs() {
    return ChannelStore.getSortedPrivateChannels().filter((channel: any) => isGroupDM(channel));
}

function getSidebarMountPoint(root: HTMLElement) {
    return root.querySelector<HTMLElement>(".scroller__99e7c") ?? root.lastElementChild as HTMLElement | null;
}

function renderGroupDMItem(channel: any) {
    const item = document.createElement("div");
    item.className = "vc-group-dms-item";
    item.setAttribute("role", "button");
    item.tabIndex = 0;

    const icon = document.createElement("img");
    icon.className = "vc-group-dms-icon";
    icon.alt = "";
    icon.src = IconUtils.getChannelIconURL({ id: channel.id, icon: channel.icon, size: 32 });

    const meta = document.createElement("div");
    meta.className = "vc-group-dms-meta";

    const name = document.createElement("div");
    name.className = "vc-group-dms-name";
    name.textContent = getGroupDMName(channel);

    const subtitle = document.createElement("div");
    subtitle.className = "vc-group-dms-subtitle";
    subtitle.textContent = `${(channel.recipients?.length ?? 0) + 1} members`;

    meta.append(name, subtitle);
    item.append(icon, meta);

    const openChannel = () => SelectedChannelActionCreators.selectPrivateChannel(channel.id);

    item.addEventListener("click", openChannel);
    item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openChannel();
        }
    });

    return item;
}

function syncRootCollapseState() {
    const root = getRoot();
    const groupMessagesSection = document.getElementById(GROUP_MESSAGES_SECTION_ID);

    if (!root || !groupMessagesSection) return;

    root.classList.toggle(COLLAPSED_GROUPS_CLASS, groupMessagesSection.classList.contains("collapsed"));
}

function ensurePanel() {
    const root = getRoot();
    if (!root) return;

    let panel = document.getElementById(PANEL_ID);

    if (!panel) {
        panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.className = "vc-group-dms-panel";

        const directMessagesHeader = document.createElement("button");
        directMessagesHeader.type = "button";
        directMessagesHeader.className = "vc-group-dms-section-header vc-group-dms-direct-header";
        directMessagesHeader.innerHTML = "<span data-vc-gdm-toggle-icon>▾</span><span>Direct Messages</span>";

        const separator = document.createElement("div");
        separator.className = "vc-group-dms-separator";

        const groupMessagesHeader = document.createElement("button");
        groupMessagesHeader.type = "button";
        groupMessagesHeader.className = "vc-group-dms-section-header";
        groupMessagesHeader.innerHTML = "<span data-vc-gdm-toggle-icon>▾</span><span>Group DMs</span>";

        const groupMessagesSection = document.createElement("div");
        groupMessagesSection.id = GROUP_MESSAGES_SECTION_ID;
        groupMessagesSection.className = "vc-group-dms-section-body";

        directMessagesHeader.addEventListener("click", () => {
            root.classList.toggle(COLLAPSED_DIRECT_CLASS);
            directMessagesHeader.classList.toggle("collapsed", root.classList.contains(COLLAPSED_DIRECT_CLASS));
        });

        groupMessagesHeader.addEventListener("click", () => {
            groupMessagesSection.classList.toggle("collapsed");
            groupMessagesHeader.classList.toggle("collapsed", groupMessagesSection.classList.contains("collapsed"));
            syncRootCollapseState();
        });

        panel.append(directMessagesHeader, separator, groupMessagesHeader, groupMessagesSection);

        const mountPoint = getSidebarMountPoint(root);
        if (mountPoint?.parentElement) {
            mountPoint.parentElement.insertBefore(panel, mountPoint);
        } else {
            root.appendChild(panel);
        }
    }

    const groupMessagesSection = document.getElementById(GROUP_MESSAGES_SECTION_ID);
    if (!groupMessagesSection) return;

    const groupMessages = getGroupDMs();
    groupMessagesSection.replaceChildren(...(
        groupMessages.length > 0
            ? groupMessages.map(renderGroupDMItem)
            : [Object.assign(document.createElement("div"), { className: "vc-group-dms-empty", textContent: "No group DMs" })]
    ));

    syncRootCollapseState();
}

function startObservers() {
    if (observer) return;

    observer = new MutationObserver(() => {
        ensurePanel();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObservers() {
    observer?.disconnect();
    observer = null;
    document.getElementById(PANEL_ID)?.remove();
    getRoot()?.classList.remove(COLLAPSED_DIRECT_CLASS, COLLAPSED_GROUPS_CLASS);
}

export default definePlugin({
    name: "GroupDMs",
    description: "Adds collapsible Direct Messages and Group DMs sections to the DM list.",
    authors: [{ name: "skver", id: 212558627016409088n }],
    tags: ["Friends", "Organisation"],
    searchTerms: ["group dms", "group dm", "direct messages"],
    startAt: StartAt.DOMContentLoaded,
    start() {
        try {
            ensurePanel();
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
