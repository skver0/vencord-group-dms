import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findByPropsLazy, findCssClassesLazy, findStoreLazy } from "@webpack";
import { Avatar, ChannelStore, IconUtils, React, RelationshipStore, Text, UserStore } from "@webpack/common";

import { useForceUpdater } from "@utils/react";

import { DEFAULT_CHUNK_SIZE } from "../../plugins/pinDms/constants";

const headerClasses = findCssClassesLazy("privateChannelsHeaderContainer", "headerText");
const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as { getPrivateChannelIds: () => string[]; };
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");
let forceUpdateGroupDms: (() => void) | undefined;

const settings = definePluginSettings({
    directCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Collapse the Direct Messages section",
        default: false,
        hidden: true
    },
    groupCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Collapse the Group DMs section",
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

export default definePlugin({
    name: "GroupDMs",
    description: "Splits the private channels list into collapsible Direct Messages and Group DMs sections.",
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
            },
            {
                match: /(?<=renderRow:this\.renderRow,)sections:\[.+?1\)]/,
                replace: "...$self.makeProps(this,{$&})"
            },
            {
                match: /renderRow(?:",|=)(\i)=>{(?<=renderDM(?:",|=).+?(\i\.\i),\{channel:.+?)/,
                replace: "$&if($self.isGroupDMIndex($1.section))return $self.renderGroupDMRow($1.section,$1.row,$2)();"
            },
            {
                match: /renderSection(?:\",|=)(\i)=>{/,
                replace: "$&if($self.isDirectDMSection($1.section))return $self.renderDirectDMSection($1);if($self.isGroupDMSection($1.section))return $self.renderGroupDMSection($1);"
            },
            {
                match: /getRowHeight(?:",|=)\((\i),(\i)\)=>{/,
                replace: "$&if($self.isChannelHidden($1,$2))return 0;"
            }
        ]
    }, {
        find: ".FRIENDS},\"friends\"",
        replacement: {
            match: /let{showLibrary:\i,/,
            replace: "$self.useGroupDMs();$&"
        }
    }],

    sections: null as number[] | null,
    instance: null as any,
    directSectionIndex: null as number | null,
    groupSectionIndex: null as number | null,

    useGroupDMs() {
        forceUpdateGroupDms = useForceUpdater();
        settings.use(["directCollapsed", "groupCollapsed"]);
    },

    start() {
        forceUpdateGroupDms?.();
    },

    stop() {
        settings.store.directCollapsed = false;
        settings.store.groupCollapsed = false;
        forceUpdateGroupDms?.();
    },

    isGroupDM(channelId: string) {
        return ChannelStore.getSortedPrivateChannels().some((channel: Channel) => channel.id === channelId && channel.isGroupDM());
    },

    getGroupDMs() {
        return ChannelStore.getSortedPrivateChannels().filter((channel: Channel) => channel.isGroupDM());
    },

    getDirectDMCount() {
        return PrivateChannelSortStore.getPrivateChannelIds().filter(channelId => !this.isGroupDM(channelId)).length;
    },

    getSections() {
        return [this.getGroupDMs().length || 1];
    },

    makeProps(instance: any, { sections }: { sections: number[]; }) {
        this.instance = instance;
        this.sections = [...sections];
        this.directSectionIndex = this.sections.length - 1;

        this.sections.push(...this.getSections());

        this.groupSectionIndex = this.sections.length - 1;

        if (this.groupSectionIndex != null) {
            this.sections[this.groupSectionIndex] = settings.store.groupCollapsed ? 0 : this.getGroupDMs().length || 1;
        }

        if (this.getDirectDMCount() === 0 && this.directSectionIndex != null) {
            this.sections[this.directSectionIndex] = 0;
        }

        return {
            sections: this.sections,
            chunkSize: this.getChunkSize(),
        };
    },

    getChunkSize() {
        const sectionHeaderSizePx = 2 * 40;
        const totalRows = this.getDirectDMCount() + this.getGroupDMs().length;
        return (sectionHeaderSizePx + totalRows * 44 + DEFAULT_CHUNK_SIZE) * 1.5;
    },

    isGroupDMSection(sectionIndex: number) {
        return this.groupSectionIndex != null && sectionIndex === this.groupSectionIndex;
    },

    isGroupDMIndex(sectionIndex: number) {
        return this.isGroupDMSection(sectionIndex);
    },

    isDirectDMSection(sectionIndex: number) {
        return this.directSectionIndex != null && sectionIndex === this.directSectionIndex;
    },

    isChannelHidden(sectionIndex: number, _rowIndex: number) {
        if (this.isGroupDMSection(sectionIndex)) return settings.store.groupCollapsed;
        if (this.isDirectDMSection(sectionIndex)) return settings.store.directCollapsed;
        return false;
    },

    toggleDirectCollapse() {
        settings.store.directCollapsed = !settings.store.directCollapsed;
        forceUpdateGroupDms?.();
    },

    toggleGroupCollapse() {
        settings.store.groupCollapsed = !settings.store.groupCollapsed;
        forceUpdateGroupDms?.();
    },

    renderDirectDMSection: ErrorBoundary.wrap(({ section }: { section: number; }) => {
        const self = this as any;
        if (!self.isDirectDMSection(section)) return null;

        const collapsed = settings.store.directCollapsed;
        const count = self.getDirectDMCount();

        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                Button,
                {
                    variant: "none",
                    size: "min",
                    className: classes(headerClasses.privateChannelsHeaderContainer, "vc-group-dms-section-container", "vc-group-dms-direct-section", collapsed && "vc-group-dms-collapsed"),
                    onClick: () => self.toggleDirectCollapse(),
                    title: "Direct Messages",
                    type: "button",
                },
                React.createElement("span", { className: "vc-group-dms-section-header" },
                    React.createElement("span", { className: headerClasses.headerText }, `Direct Messages (${count})`),
                    React.createElement("span", { className: "vc-group-dms-collapse-icon", "aria-hidden": true }, collapsed ? "▸" : "▾")
                )
            ),
            React.createElement(Divider, { className: "vc-group-dms-separator" })
        );
    }, { noop: true }),

    renderGroupDMSection: ErrorBoundary.wrap(({ section }: { section: number; }) => {
        const self = this as any;
        if (!self.isGroupDMSection(section)) return null;

        const collapsed = settings.store.groupCollapsed;
        const count = self.getGroupDMs().length;

        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                Button,
                {
                    variant: "none",
                    size: "min",
                    className: classes(headerClasses.privateChannelsHeaderContainer, "vc-group-dms-section-container", "vc-group-dms-group-section", collapsed && "vc-group-dms-collapsed"),
                    onClick: () => self.toggleGroupCollapse(),
                    title: "Group DMs",
                    type: "button",
                },
                React.createElement("span", { className: "vc-group-dms-section-header" },
                    React.createElement("span", { className: headerClasses.headerText }, `Group DMs (${count})`),
                    React.createElement("span", { className: "vc-group-dms-collapse-icon", "aria-hidden": true }, collapsed ? "▸" : "▾")
                )
            ),
            React.createElement(Divider, { className: "vc-group-dms-separator" })
        );
    }, { noop: true }),

    renderGroupDMRow(sectionIndex: number, index: number, _ChannelComponent: React.ComponentType<any>) {
        const self = this;
        return ErrorBoundary.wrap(() => {
            if (self.isChannelHidden(sectionIndex, index)) return null;

            const channel = self.getGroupDMs()[index];
            if (!channel) return null;

            const openChannel = () => SelectedChannelActionCreators.selectPrivateChannel(channel.id);

            return React.createElement(
                Button,
                {
                    variant: "none",
                    size: "min",
                    className: "vc-group-dms-row",
                    onClick: openChannel,
                    title: getGroupDMName(channel),
                    onKeyDown: (event: any) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openChannel();
                        }
                    },
                    role: "button",
                    tabIndex: 0,
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
        }, { noop: true });
    }
});
