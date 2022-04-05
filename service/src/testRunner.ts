import path from 'path'

import { runCLI } from '@jest/core'
import { AggregatedResult } from '@jest/test-result'
import retry from 'async-retry'

import { alertOnResult } from './alerts'
import Run from './run'
import { type EnhancedAggregatedResult } from './types'

import type { Config } from '@jest/types'

const runJest = async function ({
    config,
}: {
    config: Config.InitialOptions
}): Promise<{ results: EnhancedAggregatedResult }> {
    const jestArgs: Config.Argv = {
        _: [],
        $0: 'sanity-runner',
        json: true,
        runInBand: true,
        config: JSON.stringify(config),
    }
    const { results } = await runCLI(jestArgs, [process.cwd()])

    // The AggregatedResult is converted to EnhancedAggregatedResult via a custom reporter.
    return { results } as { results: EnhancedAggregatedResult }
}

const logResults = function (
    results: AggregatedResult,
    testVariables: Record<string, unknown>,
    retryCount: number,
    runId: string,
    executionId: string,
) {
    for (const suiteResults of results.testResults) {
        for (const testCaseResults of suiteResults.testResults) {
            const fileName = path.basename(suiteResults.testFilePath)
            const testName = fileName.substring(0, fileName.lastIndexOf('.'))
            const formatted = {
                variables: testVariables,
                retryCount: retryCount,
                duration: testCaseResults.duration ? testCaseResults.duration / 1000 : null,
                status: suiteResults.numPendingTests > 0 ? 'skipped' : testCaseResults.status,
                endTime: suiteResults.perfStats.end,
                startTime: suiteResults.perfStats.start,
                testName,
                runId: runId,
                executionId: executionId,
            }
            console.log(JSON.stringify(formatted))
        }
    }
}

export default class TestRunner {
    async runTests(
        testFiles: Record<string, string>,
        testVariables: Partial<Record<string, string>>,
        maxRetryCount: number,
        executionId: string,
    ) {
        let retryCount = 0
        const run = new Run(testVariables)
        try {
            await run.writeSuites(testFiles)
            const results = await retry(
                async () => {
                    const { results: jestResults } = await runJest({ config: run.jestConfig() })
                    // force retry if test was unsuccesfull
                    // if last retry, return as normal
                    if (!jestResults.success) {
                        if (retryCount !== maxRetryCount) {
                            throw new Error('Test Failed!')
                        }
                    }
                    return jestResults
                },
                {
                    retries: maxRetryCount,
                    onRetry: function () {
                        retryCount++
                    },
                },
            )
            logResults(results, testVariables, retryCount, run.id, executionId)
            await alertOnResult({ testFiles, results, testVariables })
            return await run.format(results)
        } finally {
            await run.cleanup()
        }
    }
}