import type { HasCwd } from '@contentlayer/core'
import * as core from '@contentlayer/core'
import { provideCwd } from '@contentlayer/core'
import { provideDummyTracing, unknownToPosixFilePath } from '@contentlayer/utils'
import type { HasClock, HasConsole, OT } from '@contentlayer/utils/effect'
import { pipe, provideTestConsole, T, These } from '@contentlayer/utils/effect'

import type { HasDocumentTypeMapState } from '../../fetchData/DocumentTypeMap.js'
import { provideDocumentTypeMapState } from '../../fetchData/DocumentTypeMap.js'
import { makeCacheItemFromFilePath } from '../../fetchData/fetchAllDocuments.js'
import { testOnly_makefilePathPatternMap } from '../../fetchData/index.js'
import type { DocumentTypes } from '../../index.js'
import { makeSource } from '../../index.js'

export const runTest = async ({
  documentTypes,
  contentDirPath: contentDirPath_,
  relativeFilePath: relativeFilePath_,
}: {
  documentTypes: DocumentTypes
  contentDirPath: string
  relativeFilePath: string
}) => {
  const eff = T.gen(function* ($) {
    const relativeFilePath = unknownToPosixFilePath(relativeFilePath_)
    const contentDirPath = unknownToPosixFilePath(contentDirPath_)

    const source = yield* $(T.tryPromise(() => makeSource({ contentDirPath, documentTypes })))
    const coreSchemaDef = yield* $(source.provideSchema)

    const documentTypeDefs = (Array.isArray(documentTypes) ? documentTypes : Object.values(documentTypes)).map((_) =>
      _.def(),
    )
    const filePathPatternMap = testOnly_makefilePathPatternMap(documentTypeDefs)

    const options: core.PluginOptions = {
      date: undefined,
      markdown: undefined,
      mdx: undefined,
      fieldOptions: core.defaultFieldOptions,
    }

    const cache = yield* $(
      pipe(
        makeCacheItemFromFilePath({
          relativeFilePath,
          contentDirPath,
          coreSchemaDef,
          filePathPatternMap,
          options,
          previousCache: undefined,
        }),
        These.effectToEither,
      ),
    )

    return cache
  })

  return runMain(eff)
}

const runMain = async <E, A>(
  eff: T.Effect<OT.HasTracer & HasClock & HasCwd & HasConsole & HasDocumentTypeMapState, E, A>,
) => {
  const logMessages: string[] = []
  const result = await pipe(
    eff,
    provideTestConsole(logMessages),
    provideDocumentTypeMapState,
    provideCwd,
    provideDummyTracing,
    T.runPromise,
  )

  return { logMessages, result }
}
