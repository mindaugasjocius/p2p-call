import { useState, useEffect } from 'react';
import { UAParser } from 'ua-parser-js';

export interface UserAgentInfo {
    browser: string;
    os: string;
    deviceType: string;
}

/**
 * Hook to parse and return user agent information
 * @returns UserAgentInfo object with browser, os, and deviceType
 */
export function useUserAgent(): UserAgentInfo | null {
    const [userAgentInfo, setUserAgentInfo] = useState<UserAgentInfo | null>(null);

    useEffect(() => {
        const parser = new UAParser();
        const result = parser.getResult();

        setUserAgentInfo({
            browser: `${result.browser.name} ${result.browser.version}`,
            os: `${result.os.name} ${result.os.version}`,
            deviceType: result.device.type || 'Desktop',
        });
    }, []);

    return userAgentInfo;
}
