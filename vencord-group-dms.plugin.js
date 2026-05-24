module.exports = class VencordGroupDMs {
  constructor() {
    this.styleId = 'vencord-group-dms-style';
    this.statusClass = 'groups-toggle-status';
    this.observer = null;
    this.lastClick = 0;
    this.boundHandler = null;
  }

  start() {
    // inject CSS
    if (!document.getElementById(this.styleId)) {
      const css = `
/* Group DMs hidden by default */
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

/* show when root has .groups-open */
.privateChannels_e6b769.groups-open li.channel__972a0.dm__972a0:has(a[aria-label*="group message"]),
.privateChannels_e6b769.groups-open li.channel__972a0.dm__972a0:has([src*="channel-icons"]) {
  max-height: 48px !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  margin: 6px 0 !important;
  padding: 0 6px !important;
}

/* Small status text on Friends button */
.${this.statusClass} {
  margin-left: 6px;
  font-size: 11px;
  opacity: 0.85;
}
/* Style for the injected "Groups" tab in the Friends tablist */
.vc-group-tab {
  display: inline-block;
  padding: 6px 10px;
  margin-left: 6px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: var(--channels-default);
}
.vc-group-tab.active {
  background: color-mix(in srgb, var(--background-primary) 80%, var(--brand-500) 20%);
  color: var(--text-normal);
}
      `;
      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = css;
      document.head.appendChild(style);
    }

    // Mutation observer to catch the Friends button when it appears
    this.observer = new MutationObserver(() => this._attachToFriends());
    this.observer.observe(document.body, { childList: true, subtree: true });

    // initial attach
    this._attachToFriends();
    // attach friends tab when available
    this._attachFriendsTab();
  }

  stop() {
    // remove injected style
    const s = document.getElementById(this.styleId);
    if (s) s.remove();

    // remove status and listeners
    this._detachFromFriends();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // remove class if present
    const root = document.querySelector('.privateChannels_e6b769');
    if (root) root.classList.remove('groups-open');

    // remove friends tab if present
    this._detachFriendsTab();
  }

  _findFriendsButton() {
    const sel = '[aria-label="Friends"],[aria-label*="Friends"],a[aria-label*="Friends"],button[aria-label*="Friends"],div[role="button"][aria-label*="Friends"]';
    let btn = document.querySelector(sel);
    if (btn) return btn;
    // fallback: find by text content
    return Array.from(document.querySelectorAll('div[role="button"],button,a')).find(el => /\bFriends\b/i.test(el.textContent || ''));
  }

  _attachToFriends() {
    const btn = this._findFriendsButton();
    if (!btn) return;

    // avoid double attaching
    if (btn.__vencord_group_dms_attached) return;
    btn.__vencord_group_dms_attached = true;

    // create status element
    let status = btn.querySelector('.' + this.statusClass);
    if (!status) {
      status = document.createElement('span');
      status.className = this.statusClass;
      status.textContent = '(groups hidden)';
      btn.appendChild(status);
    }

    // attach click handler for double-click toggle
    this.boundHandler = (e) => {
      const now = Date.now();
      if (now - this.lastClick < 350) {
        const root = document.querySelector('.privateChannels_e6b769');
        if (!root) return;
        const isOpen = root.classList.toggle('groups-open');
        status.textContent = isOpen ? '(groups open)' : '(groups hidden)';
        e.stopPropagation();
      }
      this.lastClick = now;
    };

    btn.addEventListener('click', this.boundHandler);
  }

  _attachFriendsTab() {
    // find the friends panel container (an element that has aria-label containing "Friends")
    const friendsContainer = document.querySelector('[aria-label*="Friends"]')?.closest('div');
    if (!friendsContainer) return;

    // find a tablist inside the friends container
    const tablist = friendsContainer.querySelector('[role="tablist"]');
    if (!tablist) return;

    // avoid duplicate
    if (tablist.__vencord_group_tab) return;
    tablist.__vencord_group_tab = true;

    const tab = document.createElement('div');
    tab.className = 'vc-group-tab';
    tab.setAttribute('role', 'tab');
    tab.tabIndex = 0;
    tab.textContent = 'Groups';

    const activate = () => {
      const root = document.querySelector('.privateChannels_e6b769');
      if (!root) return;
      const isOpen = root.classList.toggle('groups-open');
      // mark active state visually
      tab.classList.toggle('active', isOpen);
      // update any Friends button status text if present
      const btn = this._findFriendsButton();
      if (btn) {
        const status = btn.querySelector('.' + this.statusClass);
        if (status) status.textContent = isOpen ? '(groups open)' : '(groups hidden)';
      }
    };

    tab.addEventListener('click', (e) => { e.stopPropagation(); activate(); });
    tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });

    // append to tablist
    tablist.appendChild(tab);

    // store reference for cleanup
    this._friendsTab = { tablist, tab };
  }

  _detachFriendsTab() {
    if (!this._friendsTab) return;
    const { tablist, tab } = this._friendsTab;
    if (tab) tab.remove();
    if (tablist) tablist.__vencord_group_tab = false;
    this._friendsTab = null;
  }

  _detachFromFriends() {
    const btn = this._findFriendsButton();
    if (!btn) return;
    if (this.boundHandler) btn.removeEventListener('click', this.boundHandler);
    const status = btn.querySelector('.' + this.statusClass);
    if (status) status.remove();
    btn.__vencord_group_dms_attached = false;
  }
};
