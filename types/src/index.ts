import { AggregatedResult } from '@jest/test-result'

import type { Browser, Page } from 'puppeteer-core'
import type { AsyncSeriesHook } from 'tapable'
import type { Logger } from 'winston'

export type EnhancedAggregatedResult = AggregatedResult & {
    screenshots: ReportScreenshots
}

export interface ClientConfiguration {
    testDir: string
    include?: string
    exclude?: string
    lambdaFunction: string
    localPort: number
    local: boolean
    outputDir: string
    retryCount: number
    timeout: number
    vars: Partial<Record<string, string>>
    testPathPatterns: Array<string>
    logFormat: 'structured' | 'terminal'
    logLevel: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly'
    progress: boolean
    concurrency: number
}

export type JUnitReport = {
    testsuites: {
        $: {
            name: string
            failures: number
            tests: number
            time: number
        }
        testsuite: Array<{
            $: {
                failures: number
                skipped?: number
                tests: number
                name: string
                time: number
            }
            testcase: Array<{
                failure: Array<string>
                $: {
                    classname: string
                    name: string
                    time: number
                }
            }>
        }>
    }
}

export type TestFilename = string

export type JUnitReportFilename = string

export type StringifiedJUnitReport = string

export type ReportScreenshots = Partial<Record<TestFilename, string>>

export type InvokeResponsePayload = {
    passed: boolean
    screenshots?: ReportScreenshots
    errors?: Array<{
        message: string
        name?: { name: string }
    }>
    testResults: Record<JUnitReportFilename, JUnitReport>
}

export type TestVariables = Partial<Record<string, string>>

export type InvokePayload = {
    testFiles: Record<string, string>
    testVariables: TestVariables
    retryCount: number
    executionId: string
}

export interface TestMetadata {
    Description?: string
    Runbook?: string
}

interface HookContext<M extends TestMetadata> {
    logger: Logger
    testMetadata: M
    testVariables: TestVariables
    runId: string
}

export interface OnTestCompleteContext<M extends TestMetadata = TestMetadata>
    extends HookContext<M> {
    getSecretValue<R = any>(secretKey: string): Promise<R | null>
    results: InvokeResponsePayload

    testDisplayName: string
    testFilename: string
    failureMessage?: string | undefined
}

export interface BeforeBrowserCleanupContext<M extends TestMetadata = TestMetadata>
    extends HookContext<M> {
    page: Page
    browser: Browser
}

export interface PluginHooks {
    onTestFailure: AsyncSeriesHook<[OnTestCompleteContext<any>], void>
    onTestSuccess: AsyncSeriesHook<[OnTestCompleteContext<any>], void>
    beforeBrowserCleanup: AsyncSeriesHook<[BeforeBrowserCleanupContext<any>], void>
}

/** Only for internal use. */
export interface SanityRunnerTestGlobals {
    sanityRunnerHooks: Pick<PluginHooks, 'beforeBrowserCleanup'>
    runId: string
    testVariables: TestVariables
    testMetadata: TestMetadata
}