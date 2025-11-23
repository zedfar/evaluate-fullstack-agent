import { useChatStore } from '@/stores/chatStore';

export const ModelSelector = () => {
  const { modelProvider, setModelProvider, useRag, setUseRag, conversationFiles } = useChatStore();

  const models = [
    {
      id: 'local' as const,
      name: 'GPT-OSS Local',
      description: 'Fast, private, free',
      icon: '🖥️',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-500',
    },
    {
      id: 'claude' as const,
      name: 'Claude Anthropic',
      description: 'High quality, 200K context',
      icon: '🤖',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-500',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">
          AI Model
        </label>
        <div className="grid grid-cols-2 gap-2">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => setModelProvider(model.id)}
              className={`
                flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-all
                ${
                  modelProvider === model.id
                    ? `${model.borderColor} ${model.bgColor}`
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-xl">{model.icon}</span>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${modelProvider === model.id ? model.color : 'text-gray-900 dark:text-gray-100'}`}>
                    {model.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {model.description}
                  </div>
                </div>
                {modelProvider === model.id && (
                  <svg
                    className={`w-5 h-5 flex-shrink-0 ${model.color}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RAG Toggle */}
      <div>
        <label className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Use RAG
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              (Search uploaded files)
            </span>
          </div>

          <div className="relative">
            <input
              type="checkbox"
              checked={useRag}
              onChange={(e) => setUseRag(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </div>
        </label>

        {/* RAG Status Info */}
        {useRag && (
          <div className="mt-2 flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <svg
              className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-blue-700 dark:text-blue-300">
              {conversationFiles.length > 0 ? (
                <span>
                  RAG enabled. Using context from {conversationFiles.length} file(s)
                </span>
              ) : (
                <span>
                  RAG enabled, but no files uploaded yet. Upload files to use this feature.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
