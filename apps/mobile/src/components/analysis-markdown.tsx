import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from './theme-provider';
import { Drawer } from './drawer';
import AnalysisMarkdownDOM from './analysis-markdown-dom';
import { isWebLink } from './markdown-links';

export function AnalysisMarkdown({ text, compact = false }: { text: string; compact?: boolean }) {
  const { colors, isDark } = useAppTheme();
  const [expandedDiagram, setExpandedDiagram] = useState<string>();

  const openLink = useCallback(async (url: string) => {
    if (isWebLink(url)) await WebBrowser.openBrowserAsync(url);
  }, []);
  const expandDiagram = useCallback(async (source: string) => setExpandedDiagram(source), []);

  return (
    <View style={{ width: '100%' }}>
      <AnalysisMarkdownDOM
        text={text}
        colors={colors}
        isDark={isDark}
        compact={compact}
        onOpenLink={openLink}
        onExpandDiagram={expandDiagram}
        dom={{
          matchContents: true,
          scrollEnabled: false,
          // Android's DOM WebView otherwise captures drags from the parent
          // ScrollView; scrollEnabled only disables its iOS scrolling.
          nestedScrollEnabled: false,
          containerStyle: { width: '100%' },
          style: { backgroundColor: 'transparent' },
        }}
      />
      {expandedDiagram !== undefined ? (
        <Drawer
          title="Diagram"
          subtitle="Zoom or scroll to explore"
          visible
          onClose={() => setExpandedDiagram(undefined)}
        >
          <ScrollView className="flex-1" contentContainerClassName="pb-6">
            <AnalysisMarkdownDOM
              text={`\`\`\`mermaid\n${expandedDiagram}\n\`\`\``}
              colors={colors}
              isDark={isDark}
              expanded
              onOpenLink={openLink}
              dom={{
                matchContents: true,
                scrollEnabled: false,
                nestedScrollEnabled: false,
                containerStyle: { width: '100%' },
                style: { backgroundColor: 'transparent' },
              }}
            />
          </ScrollView>
        </Drawer>
      ) : null}
    </View>
  );
}
