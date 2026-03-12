import { describe, expect, it } from 'vitest';
import { buildSilentInstallerLauncherScript } from '../../src/main/windows-nsis-updater';

describe('buildSilentInstallerLauncherScript', () => {
  it('runs the silent installer directly and relaunches the app afterward', () => {
    const script = buildSilentInstallerLauncherScript(
      'C:\\Users\\user\\AppData\\Local\\testo-design-suite\\updater\\testo-design-suite-0.1.6.exe',
      'C:\\Users\\user\\AppData\\Local\\Programs\\TestoDesignSuite\\testo-design-suite.exe',
    );

    expect(script).toContain(
      'call "C:\\Users\\user\\AppData\\Local\\testo-design-suite\\updater\\testo-design-suite-0.1.6.exe" /S',
    );
    expect(script).toContain('if not "%exit_code%"=="0" exit /b %exit_code%');
    expect(script).toContain(
      'if exist "C:\\Users\\user\\AppData\\Local\\Programs\\TestoDesignSuite\\testo-design-suite.exe" start "" "C:\\Users\\user\\AppData\\Local\\Programs\\TestoDesignSuite\\testo-design-suite.exe"',
    );
  });

  it('escapes quoted paths for batch execution', () => {
    const script = buildSilentInstallerLauncherScript(
      'C:\\temp\\folder "quoted"\\installer.exe',
      'C:\\Program Files\\Testo "Suite"\\testo-design-suite.exe',
    );

    expect(script).toContain('call "C:\\temp\\folder ""quoted""\\installer.exe" /S');
    expect(script).toContain(
      'if exist "C:\\Program Files\\Testo ""Suite""\\testo-design-suite.exe" start "" "C:\\Program Files\\Testo ""Suite""\\testo-design-suite.exe"',
    );
  });
});
