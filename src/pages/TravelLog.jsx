import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import defaultTravelData from '../data/travel.json';
import TravelMap, { HOME_PIN_ID } from '../components/TravelMap/TravelMap';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import { useAdminStore } from '../stores/adminStore';
import {
  parseYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from '../utils/youtube';
import styles from './TravelLog.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/** Content width at which the map and the trip log sit side by side.
    The desktop shell eats 512px of chrome, so this splits from a 1440px window. */
const SPLIT_MIN_WIDTH = 920;

// The page renders inside two shells with very different content widths (the
// desktop split-view reserves 420px for the menu), so a window-width media
// query would be wrong in both directions. Measure the container instead.
function useSplitLayout(ref) {
  const [isSplit, setIsSplit] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      setIsSplit(el.offsetWidth >= SPLIT_MIN_WIDTH);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return isSplit;
}

function tripYear(period) {
  const match = String(period ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function tripYearKey(trip) {
  const year = tripYear(trip.period);
  return year > 0 ? String(year) : 'unknown';
}

function sortTripsChronologically(trips) {
  return [...trips].sort((a, b) => {
    const yearDiff = tripYear(a.period) - tripYear(b.period);
    if (yearDiff !== 0) return yearDiff;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function groupTripsByYear(trips) {
  const groups = new Map();

  for (const trip of trips) {
    const yearKey = tripYearKey(trip);
    const label = yearKey === 'unknown' ? 'Unknown' : yearKey;
    if (!groups.has(yearKey)) {
      groups.set(yearKey, { yearKey, label, trips: [] });
    }
    groups.get(yearKey).trips.push(trip);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.yearKey === 'unknown') return 1;
    if (b.yearKey === 'unknown') return -1;
    return Number(b.yearKey) - Number(a.yearKey);
  });
}

function tripCoverSrc(trip) {
  const cover = typeof trip.coverUrl === 'string' ? trip.coverUrl.trim() : '';
  if (cover) return cover;
  const yt = parseYoutubeVideoId(trip.videoUrl);
  if (yt) return youtubeThumbnailUrl(yt);
  return '';
}

function validPhotos(trip) {
  return (trip.photos || []).filter(
    (p) => p && typeof p.url === 'string' && p.url.trim(),
  );
}

function tripHasBodyContent(trip) {
  return (
    Boolean(tripCoverSrc(trip)) ||
    Boolean(trip.summary) ||
    (trip.highlights?.length ?? 0) > 0 ||
    validPhotos(trip).length > 0 ||
    Boolean(parseYoutubeVideoId(trip.videoUrl))
  );
}

function TripTimelineBody({ trip, isSelected, onSelectPhoto }) {
  const yt = parseYoutubeVideoId(trip.videoUrl);
  const cover = tripCoverSrc(trip);
  const photos = validPhotos(trip);

  return (
    <div className={styles.timelineBody}>
      {cover && (
        <div className={styles.timelineCoverWrap}>
          <img src={cover} alt="" className={styles.timelineCover} loading="lazy" />
        </div>
      )}

      {trip.summary && <p className={styles.detailSummary}>{trip.summary}</p>}

      {(trip.highlights?.length ?? 0) > 0 && (
        <div className={styles.highlightsBlock}>
          <h4 className={styles.highlightsLabel}>HIGHLIGHTS</h4>
          <ul className={styles.highlightsList}>
            {trip.highlights.map((h, j) => (
              <li key={j}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {photos.length > 0 && (
        <div className={styles.photoStrip}>
          {photos.map((photo, j) => (
            <button
              key={j}
              type="button"
              className={styles.photoThumb}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPhoto(photo);
              }}
            >
              <img src={photo.url.trim()} alt={photo.caption || ''} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {yt && isSelected && (
        <div className={styles.videoBlock}>
          <h4 className={styles.videoLabel}>TRAVEL VIDEO</h4>
          <div className={styles.videoEmbed}>
            <iframe
              title={`${trip.location} video`}
              src={youtubeEmbedUrl(yt)}
              className={styles.videoIframe}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TravelLog() {
  const getData = useAdminStore((s) => s.getData);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [travel, setTravel] = useState(defaultTravelData);
  const trips = travel.trips ?? [];
  const home = travel.home ?? defaultTravelData.home;

  const sortedTrips = useMemo(
    () => sortTripsChronologically(trips),
    [trips],
  );

  const yearGroups = useMemo(
    () => groupTripsByYear(sortedTrips),
    [sortedTrips],
  );

  const [selectedId, setSelectedId] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const tripItemRefs = useRef(new Map());

  const splitRef = useRef(null);
  const isSplit = useSplitLayout(splitRef);

  const refreshTravel = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    try {
      const data = await getData('travel');
      setTravel(data);
    } catch (err) {
      console.error('Failed to load travel data:', err);
    }
  }, [getData]);

  useEffect(() => {
    if (!isAdminUi) {
      setTravel(defaultTravelData);
      return;
    }
    refreshTravel();
  }, [isAdminUi, refreshTravel]);

  useEffect(() => {
    if (!isAdminUi) return undefined;
    const onSaved = (e) => {
      if (e.detail?.collection !== 'travel') return;
      refreshTravel();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => window.removeEventListener('admin-collection-saved', onSaved);
  }, [isAdminUi, refreshTravel]);

  useEffect(() => {
    if (selectedId == null) return;
    if (selectedId === HOME_PIN_ID) return;
    if (sortedTrips.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!sortedTrips.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [sortedTrips, selectedId]);

  useEffect(() => {
    if (selectedId == null || selectedId === HOME_PIN_ID) return;
    tripItemRefs.current.get(selectedId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedId]);

  const handleSelectTrip = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const handleSelectHome = useCallback(() => {
    setSelectedId(HOME_PIN_ID);
  }, []);

  const setTripItemRef = useCallback((id, node) => {
    if (node) tripItemRefs.current.set(id, node);
    else tripItemRefs.current.delete(id);
  }, []);

  return (
    <div className={styles.container}>
      <div
        ref={splitRef}
        className={`${styles.split} ${isSplit ? styles.splitActive : styles.splitStacked}`}
      >
        {/* Map */}
        <motion.section
          className={`${styles.section} ${styles.mapColumn}`}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> WORLD MAP
          </h2>
          <EditableSection collection="travel" dataKey="home" singleton>
            <TravelMap
              trips={trips}
              home={home}
              selectedId={selectedId}
              onSelectTrip={handleSelectTrip}
              onSelectHome={handleSelectHome}
            />
          </EditableSection>
        </motion.section>

        {/* Trip timeline */}
        <section className={`${styles.section} ${styles.logColumn}`}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> TRIP LOG
          </h2>
          <EditableSection collection="travel" dataKey="trips">
            {sortedTrips.length === 0 ? (
              <p className={styles.emptyTimeline}>No trips logged yet.</p>
            ) : (
              <div className={styles.timelineByYear}>
                {yearGroups.map((group) => {
                  const tripLabel = group.trips.length === 1 ? 'trip' : 'trips';

                  return (
                    <section key={group.yearKey} className={styles.yearSection}>
                      <h3 className={styles.yearLabel}>
                        {group.label}
                        <span className={styles.yearCount}>
                          · {group.trips.length} {tripLabel}
                        </span>
                      </h3>
                      <div className={styles.timeline}>
                        {group.trips.map((trip) => {
                          const fullIndex = trips.findIndex((t) => t.id === trip.id);
                          const isSelected =
                            trip.id === selectedId && selectedId !== HOME_PIN_ID;
                          const hasBody = tripHasBodyContent(trip);

                          return (
                            <div
                              key={trip.id}
                              ref={(node) => setTripItemRef(trip.id, node)}
                              className={`${styles.timelineItem}${isSelected ? ` ${styles.timelineItemActive}` : ''}`}
                            >
                              <div
                                className={`${styles.timelineDot}${isSelected ? ` ${styles.timelineDotActive}` : ''}`}
                                aria-hidden
                              />
                              <article className={styles.timelineCard}>
                                <button
                                  type="button"
                                  className={styles.timelineHeader}
                                  onClick={() => handleSelectTrip(trip.id)}
                                  aria-pressed={isSelected}
                                  aria-expanded={isSelected && hasBody}
                                >
                                  <div className={styles.timelineHeaderMain}>
                                    <span className={styles.timelinePeriod}>
                                      {trip.period}
                                    </span>
                                    <div className={styles.timelineTitleRow}>
                                      <h4 className={styles.timelineLocation}>
                                        {trip.location}
                                      </h4>
                                      {fullIndex >= 0 && (
                                        <span
                                          className={styles.timelineControls}
                                          onClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => e.stopPropagation()}
                                        >
                                          <EditableItemControls index={fullIndex} />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {hasBody && (
                                    <span
                                      className={`${styles.tripChevron}${isSelected ? ` ${styles.tripChevronOpen}` : ''}`}
                                      aria-hidden
                                    >
                                      &#9662;
                                    </span>
                                  )}
                                </button>

                                <AnimatePresence initial={false}>
                                  {isSelected && hasBody && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                                      style={{ overflow: 'hidden' }}
                                    >
                                      <TripTimelineBody
                                        trip={trip}
                                        isSelected={isSelected}
                                        onSelectPhoto={setLightboxPhoto}
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </article>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </EditableSection>
        </section>
      </div>

      {/* Photo lightbox */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            className={styles.lightbox}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxPhoto(null)}
          >
            <motion.div
              className={styles.lightboxContent}
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxPhoto.url.trim()}
                alt={lightboxPhoto.caption || ''}
                className={styles.lightboxImage}
              />
              {lightboxPhoto.caption && (
                <div className={styles.lightboxInfo}>
                  <p>{lightboxPhoto.caption}</p>
                </div>
              )}
              <button
                type="button"
                className={styles.lightboxClose}
                onClick={() => setLightboxPhoto(null)}
              >
                &times;
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
