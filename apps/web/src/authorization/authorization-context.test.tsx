// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthorizationProvider, Can } from './authorization-context';

afterEach(cleanup);

describe('frontend permission helpers', () => {
  it('renders allowed actions from permission keys', () => {
    render(
      <AuthorizationProvider permissions={['users.invite']}>
        <Can permission="users.invite">Invite user</Can>
        <Can permission="settings.update">Edit settings</Can>
      </AuthorizationProvider>,
    );
    expect(screen.getByText('Invite user')).toBeDefined();
    expect(screen.queryByText('Edit settings')).toBeNull();
  });
});
