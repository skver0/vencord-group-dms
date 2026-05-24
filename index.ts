import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, IconUtils, RelationshipStore, UserStore } from "@webpack/common";

const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as { getPrivateChannelIds: () => string[]; };
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");
let sidebarObserver: MutationObserver | undefined;
let sidebarMount: HTMLDivElement | undefined;
let mountRetryHandle: number | undefined;

const settings = definePluginSettings({
    groupCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Collapse the Groups panel",
        default: false,
        hidden: true
    }
});

function getGroupDMName(channel: Channel) {
    return channel.name || channel.recipients
        .map(UserStore.getUser)
        .filter(Boolean)
        .map((user: any) => RelationshipStore.getNickname(user.id) || user.username || user.globalName || user.displayName || user.id)
        .join(", ");
}

function getShortGroupDMName(channel: Channel) {
    if (channel.name) return channel.name;

    const recipients = channel.recipients
        .map(UserStore.getUser)
        .filter(Boolean)
        .map((user: any) => RelationshipStore.getNickname(user.id) || user.username || user.globalName || user.displayName || user.id);

    const head = recipients.slice(0, 2).join(", ");
    const remaining = recipients.length - 2;

    return remaining > 0 ? `${head} +${remaining}` : head;
}

function getGroupDMs() {
    return ChannelStore.getSortedPrivateChannels().filter((channel: Channel) => channel.isGroupDM());
}

function getDirectDMCount() {
    return PrivateChannelSortStore.getPrivateChannelIds().filter(channelId => !ChannelStore.getChannel(channelId)?.isGroupDM?.()).length;
}

function createClassDiv(className: string) {
    const element = document.createElement("div");
    element.className = className;
    return element;
}

function renderGroupDMRow(channel: Channel) {
    const openChannel = () => SelectedChannelActionCreators.selectPrivateChannel(channel.id);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "vc-btn-base vc-btn-none vc-btn-min vc-group-dms-row";
    row.title = getGroupDMName(channel);
    row.addEventListener("click", openChannel);

    const icon = document.createElement("img");
    icon.className = "vc-group-dms-row-icon";
    icon.src = IconUtils.getChannelIconURL({ id: channel.id, icon: channel.icon, size: 32 }) ?? "";
    icon.alt = "";

    const meta = createClassDiv("vc-group-dms-row-meta");
    const name = createClassDiv("vc-group-dms-row-name");
    name.textContent = getShortGroupDMName(channel);
    const subtitle = createClassDiv("vc-group-dms-row-subtitle");
    subtitle.textContent = `${channel.recipients.length + 1} Members`;
    meta.append(name, subtitle);

    row.append(icon, meta);
    return row;
}

function renderGroupsPanelDom() {
    if (!sidebarMount) return;

    const collapsed = settings.store.groupCollapsed;
    const groupDMs = getGroupDMs();

    const panel = document.createElement("div");
    panel.className = "vc-group-dms-panel";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "vc-btn-base vc-btn-none vc-btn-min vc-group-dms-panel-header";
    header.title = "Groups";
    header.setAttribute("aria-expanded", String(!collapsed));
    header.addEventListener("click", () => {
        settings.store.groupCollapsed = !settings.store.groupCollapsed;
        renderGroupsPanelDom();
    });

    const title = createClassDiv("vc-group-dms-panel-title");
    title.textContent = `Groups (${groupDMs.length})`;

    const chevron = createClassDiv("vc-group-dms-collapse-icon");
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = collapsed ? "▸" : "▾";

    header.append(title, chevron);
    panel.append(header);

    if (!collapsed) {
        const divider = document.createElement("hr");
        divider.className = "vc-divider vc-group-dms-panel-divider";
        panel.append(divider);

        const list = document.createElement("div");
        list.className = "vc-group-dms-list";
        for (const channel of groupDMs) list.append(renderGroupDMRow(channel));
        panel.append(list);
    }

    sidebarMount.replaceChildren(panel);
}

function mountGroupsPanel() {
    const sidebar = document.querySelector(".privateChannels_e6b769");
    if (!sidebar) return false;

    const friendsButton = sidebar.querySelector('[data-list-item-id$="___friends"]');
    const friendsContainer = friendsButton?.closest(".friendsButtonContainer_e6b769");
    if (!sidebarMount) {
        sidebarMount = document.createElement("div");
        sidebarMount.className = "vc-group-dms-mount";
    }

    if (!sidebarMount.isConnected) {
        if (friendsContainer?.parentElement) {
            friendsContainer.parentElement.insertBefore(sidebarMount, friendsContainer.nextSibling);
        } else {
            const scroller = sidebar.querySelector(".scroller__99e7c");
            sidebar.insertBefore(sidebarMount, scroller ?? null);
        }
    }

    renderGroupsPanelDom();
    return true;
}

function startSidebarObserver() {
    const tryMount = () => {
        if (mountGroupsPanel()) {
            if (mountRetryHandle != null) {
                cancelAnimationFrame(mountRetryHandle);
                mountRetryHandle = undefined;
            }
            return;
        }

        mountRetryHandle = requestAnimationFrame(tryMount);
    };

    tryMount();

    sidebarObserver = new MutationObserver(() => mountGroupsPanel());
    sidebarObserver.observe(document.body, { childList: true, subtree: true });
}

function stopSidebarObserver() {
    sidebarObserver?.disconnect();
    sidebarObserver = undefined;
    if (mountRetryHandle != null) {
        cancelAnimationFrame(mountRetryHandle);
        mountRetryHandle = undefined;
    }
    sidebarMount?.remove();
    sidebarMount = undefined;
}

export default definePlugin({
    name: "GroupDMs",
    description: "Adds a Groups panel under Friends and hides group DMs from the direct message list.",
    tags: ["Friends", "Organisation"],
    authors: [{ name: "skver", id: 212558627016409088n }],
    settings,
    startAt: StartAt.WebpackReady,

    patches: [{
        find: '"dm-quick-launcher"===',
        replacement: [
            {
                match: /(?<=channels:\i,)privateChannelIds:(\i)(?=,listRef:)/,
                replace: "privateChannelIds:$1.filter(c=>!$self.isGroupDM(c))"
            }
        ]
    }],

    start() {
        settings.use(["groupCollapsed"]);
        startSidebarObserver();
    },

    stop() {
        settings.store.groupCollapsed = false;
        stopSidebarObserver();
    },

    isGroupDM(channelId: string) {
        return ChannelStore.getSortedPrivateChannels().some((channel: Channel) => channel.id === channelId && channel.isGroupDM());
    },

    getGroupDMs,
    getDirectDMCount,
});
