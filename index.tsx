import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import definePlugin, { StartAt } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Avatar, ChannelStore, IconUtils, React, RelationshipStore, Text, TextInput, useMemo, useState, useStateFromStores, UserStore, createRoot } from "@webpack/common";
import { Modal, openModal } from "@webpack/common/modals";
import type { RenderModalProps } from "@vencord/discord-types";

const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as { getPrivateChannelIds: () => string[]; };
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");

let sidebarObserver: MutationObserver | undefined;
let sidebarMount: HTMLDivElement | undefined;
let mountRetryHandle: number | undefined;
let sidebarRoot: ReturnType<typeof createRoot> | undefined;

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

function getGroupDMSearchText(channel: Channel) {
    const recipientNames = channel.recipients
        .map(UserStore.getUser)
        .filter(Boolean)
        .map((user: any) => `${RelationshipStore.getNickname(user.id) || ""} ${user.username || ""} ${user.globalName || ""} ${user.displayName || ""} ${user.id}`.trim())
        .join(" ");

    return `${channel.name || ""} ${getGroupDMName(channel)} ${recipientNames}`.toLowerCase();
}

function getGroupDMs() {
    return ChannelStore.getSortedPrivateChannels().filter((channel: Channel) => channel.isGroupDM());
}

function getDirectDMCount() {
    return PrivateChannelSortStore.getPrivateChannelIds().filter(channelId => !ChannelStore.getChannel(channelId)?.isGroupDM?.()).length;
}

function openGroupDM(channelId: string, onClose?: () => void) {
    onClose?.();
    SelectedChannelActionCreators.selectPrivateChannel(channelId);
}

function renderGroupDMRow(channel: Channel, onClose: () => void) {
    return (
        <Button
            key={channel.id}
            variant="none"
            size="min"
            className="vc-group-dms-row"
            onClick={() => openGroupDM(channel.id, onClose)}
            title={getGroupDMName(channel)}
            type="button"
        >
            <Avatar
                src={IconUtils.getChannelIconURL({ id: channel.id, icon: channel.icon, size: 32 }) ?? ""}
                className="vc-group-dms-row-icon"
            />
            <div className="vc-group-dms-row-meta">
                <BaseText tag="div" size="sm" className="vc-group-dms-row-name">{getShortGroupDMName(channel)}</BaseText>
                <Text variant="text-xs/medium" className="vc-group-dms-row-subtitle">{`${channel.recipients.length + 1} Members`}</Text>
            </div>
        </Button>
    );
}

function GroupsModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [search, setSearch] = useState("");
    const groupDMs = useStateFromStores([ChannelStore], getGroupDMs);

    const filteredGroupDMs = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) return groupDMs;

        return groupDMs.filter(channel => getGroupDMSearchText(channel).includes(normalizedSearch));
    }, [groupDMs, search]);

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={`Group Chats (${groupDMs.length})`}
        >
            <div className="vc-group-dms-modal">
                <TextInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search private groups"
                    className="vc-group-dms-modal-search"
                />

                <Divider className="vc-group-dms-modal-divider" />

                <div className="vc-group-dms-modal-list">
                    {filteredGroupDMs.length > 0 ? filteredGroupDMs.map(channel => renderGroupDMRow(channel, modalProps.onClose)) : (
                        <BaseText tag="div" size="sm" className="vc-group-dms-modal-empty">
                            No group chats match this search.
                        </BaseText>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function openGroupsModal() {
    openModal(modalProps => <GroupsModal modalProps={modalProps} />);
}

function GroupDMsLauncher() {
    const groupCount = useStateFromStores([ChannelStore], () => getGroupDMs().length);

    return (
        <Button
            variant="none"
            size="min"
            className="vc-group-dms-launcher"
            onClick={openGroupsModal}
            type="button"
            title="Open group chats"
        >
            <BaseText tag="span" size="sm" className="vc-group-dms-launcher-title">Groups</BaseText>
            <Text variant="text-xs/medium" className="vc-group-dms-launcher-subtitle">{`${groupCount} Group${groupCount === 1 ? "" : "s"}`}</Text>
        </Button>
    );
}

function mountGroupsButton() {
    const sidebar = document.querySelector(".privateChannels_e6b769");
    if (!sidebar) return false;

    const friendsButton = sidebar.querySelector('[data-list-item-id$="___friends"]');
    const friendsContainer = friendsButton?.closest(".friendsButtonContainer_e6b769");
    const mountParent = friendsContainer?.parentElement ?? sidebar;
    const scroller = sidebar.querySelector(".scroller__99e7c");
    const beforeNode = friendsContainer?.nextSibling ?? scroller ?? null;

    if (!sidebarMount) {
        sidebarMount = document.createElement("div");
        sidebarMount.className = "vc-group-dms-mount";
    }

    if (sidebarMount.parentElement !== mountParent || sidebarMount.nextSibling !== beforeNode) {
        mountParent.insertBefore(sidebarMount, beforeNode);
    }

    if (!sidebarRoot) {
        sidebarRoot = createRoot(sidebarMount);
    }

    sidebarRoot.render(
        <ErrorBoundary>
            <GroupDMsLauncher />
        </ErrorBoundary>
    );

    return true;
}

function startSidebarObserver() {
    const tryMount = () => {
        if (mountGroupsButton()) {
            if (mountRetryHandle != null) {
                cancelAnimationFrame(mountRetryHandle);
                mountRetryHandle = undefined;
            }
            return;
        }

        mountRetryHandle = requestAnimationFrame(tryMount);
    };

    tryMount();

    sidebarObserver = new MutationObserver(() => mountGroupsButton());
    sidebarObserver.observe(document.body, { childList: true, subtree: true });
}

function stopSidebarObserver() {
    sidebarObserver?.disconnect();
    sidebarObserver = undefined;

    if (mountRetryHandle != null) {
        cancelAnimationFrame(mountRetryHandle);
        mountRetryHandle = undefined;
    }

    sidebarRoot?.unmount();
    sidebarRoot = undefined;

    sidebarMount?.remove();
    sidebarMount = undefined;
}

export default definePlugin({
    name: "GroupDMs",
    description: "Adds a Groups button under Friends and hides group DMs from the direct message list.",
    tags: ["Friends", "Organisation"],
    authors: [{ name: "skver", id: 212558627016409088n }],
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
        startSidebarObserver();
    },

    stop() {
        stopSidebarObserver();
    },

    isGroupDM(channelId: string) {
        return ChannelStore.getSortedPrivateChannels().some((channel: Channel) => channel.id === channelId && channel.isGroupDM());
    },

    getGroupDMs,
    getDirectDMCount,
});
