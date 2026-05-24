import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Avatar, ChannelStore, IconUtils, React, RelationshipStore, Text, UserStore, createRoot } from "@webpack/common";

const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as { getPrivateChannelIds: () => string[]; };
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");
let sidebarObserver: MutationObserver | undefined;
let sidebarMount: HTMLDivElement | undefined;
let sidebarRoot: ReturnType<typeof createRoot> | undefined;

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

function GroupDMRow({ channel }: { channel: Channel; }) {
    const openChannel = () => SelectedChannelActionCreators.selectPrivateChannel(channel.id);

    return React.createElement(
        Button,
        {
            variant: "none",
            size: "min",
            className: "vc-group-dms-row",
            onClick: openChannel,
            title: getGroupDMName(channel),
            type: "button",
        },
        React.createElement(Avatar, {
            src: IconUtils.getChannelIconURL({ id: channel.id, icon: channel.icon, size: 32 }),
            size: "SIZE_32",
            className: "vc-group-dms-row-icon"
        }),
        React.createElement(
            "div",
            { className: "vc-group-dms-row-meta" },
            React.createElement("div", { className: "vc-group-dms-row-name" }, getShortGroupDMName(channel)),
            React.createElement(Text, { variant: "text-xs/medium", className: "vc-group-dms-row-subtitle" }, `${channel.recipients.length + 1} Members`)
        )
    );
}

function GroupsPanel() {
    const [collapsed, setCollapsed] = React.useState(settings.store.groupCollapsed);
    const groupDMs = getGroupDMs();

    React.useEffect(() => {
        settings.store.groupCollapsed = collapsed;
    }, [collapsed]);

    return React.createElement(
        "div",
        { className: "vc-group-dms-panel" },
        React.createElement(
            Button,
            {
                variant: "none",
                size: "min",
                className: "vc-group-dms-panel-header",
                onClick: () => setCollapsed(current => !current),
                type: "button",
                title: "Groups",
            },
            React.createElement("span", { className: "vc-group-dms-panel-title" }, `Groups (${groupDMs.length})`),
            React.createElement("span", { className: "vc-group-dms-collapse-icon", "aria-hidden": true }, collapsed ? "▸" : "▾")
        ),
        !collapsed && React.createElement(
            React.Fragment,
            null,
            React.createElement(Divider, { className: "vc-group-dms-panel-divider" }),
            React.createElement(
                "div",
                { className: "vc-group-dms-list" },
                groupDMs.map(channel => React.createElement(GroupDMRow, { key: channel.id, channel }))
            )
        )
    );
}

function mountGroupsPanel() {
    const sidebar = document.querySelector(".privateChannels_e6b769");
    if (!sidebar) return;

    const scroller = sidebar.querySelector(".scroller__99e7c");
    if (!sidebarMount) {
        sidebarMount = document.createElement("div");
        sidebarMount.className = "vc-group-dms-mount";
    }

    if (!sidebarMount.isConnected) {
        sidebar.insertBefore(sidebarMount, scroller ?? null);
    }

    if (!sidebarRoot) {
        sidebarRoot = createRoot(sidebarMount);
    }

    sidebarRoot.render(React.createElement(GroupsPanel));
}

function startSidebarObserver() {
    mountGroupsPanel();

    sidebarObserver = new MutationObserver(() => mountGroupsPanel());
    sidebarObserver.observe(document.body, { childList: true, subtree: true });
}

function stopSidebarObserver() {
    sidebarObserver?.disconnect();
    sidebarObserver = undefined;
    sidebarRoot?.unmount();
    sidebarRoot = undefined;
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
