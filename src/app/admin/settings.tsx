/** SettingsPage — AdminShell copy, with the admin nav strip. */
import React from 'react';
import { Page } from '../../components/ui';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { SettingsContent } from '../../components/SettingsContent';

export default function AdminSettingsScreen() {
  return (
    <Page>
      <AdminNavStrip activeRoute="adminsettings" />
      <SettingsContent />
    </Page>
  );
}
