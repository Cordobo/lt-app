import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableNativeFeedback,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {FlatList} from 'react-native-gesture-handler';
import LessonRow, {LESSON_ROW_HEIGHT} from './LessonRow.react';
import StaticLessonRow from './StaticLessonRow.react';
import useStatusBarStyle from '../../hooks/useStatusBarStyle';
import CourseData from '../../course-data';
import DownloadManager from '../../download-manager';
import prettyBytes from 'pretty-bytes';
import {usePreference} from '../../persistence';
import {Icon} from 'react-native-elements';

import {throttle} from 'lodash';

const AllLessons = ({route}) => {
  useStatusBarStyle('white', 'dark-content');
  const {course} = route.params;
  const indices = CourseData.getLessonIndices(course);

  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [lastChildUpdateTime, setLastChildUpdateTime] = useState<Date | null>(null);

  const downloadQuality = usePreference<Quality>('download-quality', 'high');
  const [downloadedCount, setDownloadedCount] = useState<number | null>(null);
  const downloadAll = useCallback(() => {
    // TODO(ios-merge): downloadQuality can be null
    const courseTitle = CourseData.getCourseShortTitle(course);

    // calculate size needed for all lessons
    const totalBytes = indices
      // no need to calculate the first lesson, its prebundled
      .filter((lesson) => lesson > 0)
      .map((lesson) =>
        CourseData.getLessonSizeInBytes(course, lesson, downloadQuality),
      )
      .reduce((acc, val) => acc + val, 0);

    Alert.alert(
      'Download all lessons?',
      `This will download all ${
        indices.length
      } ${courseTitle} lessons (${prettyBytes(
        totalBytes,
      )}) to your device for offline playback.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: () => {
            indices
              // no need to download the first lesson, its prebundled
              .filter((lesson) => lesson > 0)
              .forEach((lesson) =>
                DownloadManager.startDownload(course, lesson),
              );
          },
        },
      ],
    );
  }, [course, indices, downloadQuality]);

  async function countDownloads() {
    const downloadedCount = (
      await Promise.all(
        indices.map((lesson) =>
          DownloadManager.genIsDownloadedForDownloadId(
            DownloadManager.getDownloadId(course, lesson),
          ),
        ),
      )
    ).reduce((acc, n) => +n + acc, 0);
    setDownloadedCount(downloadedCount);
  }

  // todo: just cache genIsDownloaded, god damn
  // cache invalidation isn't even hard here, we can assume we're the only ones changing the download state
  const throttledCountDownloads = throttle(countDownloads, 2000);

  useEffect(useCallback(() => { throttledCountDownloads() }, []), [lastUpdateTime, lastChildUpdateTime]);

  useFocusEffect(
    useCallback(() => {
      setLastUpdateTime(new Date());
    }, []),
  );

  const allDownloaded = downloadedCount !== null && downloadedCount === indices.length;
  
  if (downloadQuality === null) {
    return null;
  }

  return (
    <>
      <FlatList
        data={indices}
        renderItem={({item}) =>
          item === 0 ? (
            <StaticLessonRow
              course={course}
              lesson={item}
              lastUpdateTime={lastUpdateTime}
            />
          ) : (
            <LessonRow
              course={course}
              lesson={item}
              lastUpdateTime={lastUpdateTime}
              setLastChildUpdateTime={setLastChildUpdateTime}
            />
          )
        }
        keyExtractor={(lesson) => String(lesson)}
        getItemLayout={(_, index) => ({
          length: LESSON_ROW_HEIGHT,
          offset: LESSON_ROW_HEIGHT * index,
          index,
        })}
      />
      {downloadedCount === null ? null :
        <View style={styles.bottomContainer}>
          <Text style={styles.bottomLeftText}>
            {downloadedCount}/{indices.length} downloaded.
          </Text>
          <View style={allDownloaded ? {opacity: 0.4} : {}}>
            <TouchableNativeFeedback onPress={downloadAll} disabled={allDownloaded}>
              <View style={styles.allButton}>
                <View>
                  <Icon
                    name="download"
                    type="font-awesome-5"
                    size={16}
                    color="#888"
                  />
                </View>
                <Text style={styles.allText}>
                  Download All
                </Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        </View>
      }
    </>
  );
};

const styles = StyleSheet.create({
  bottomContainer: {
    backgroundColor: '#fff',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 24,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allButton: {
    borderColor: '#2980b9',
    flex: 0,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  bottomLeftText: {
    color: 'black',
    fontSize: 20,
  },
  allText: {
    color: '#888',
    fontSize: 16,
  },
});

export default AllLessons;
