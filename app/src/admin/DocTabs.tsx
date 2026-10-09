// The document tabs of stories and projects, in the markup of DocTabLink.tsx.

import { DocTabLink } from './DocTabLink'
import { strings } from './strings'

export const StoryTab = () => <DocTabLink label={strings.history.story} path="" />
export const HistoryTab = () => <DocTabLink label={strings.history.tab} path="/versions" />
export const OverviewTab = () => <DocTabLink label={strings.overview.tab} path="/overview" />
export const SettingsTab = () => <DocTabLink label={strings.overview.settings} path="" />
