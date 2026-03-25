import { motion } from 'framer-motion';
import livestreamData from '../data/livestream.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import styles from './Livestream.module.css';

const TWITCH_CHANNEL = livestreamData.twitchChannel;
const PARENT_DOMAIN = window.location.hostname;
const SCHEDULE = livestreamData.schedule;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function Livestream() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Twitch Player */}
      <motion.div variants={fadeUp} className={styles.playerSection}>
        <div className={styles.playerWrapper}>
          <iframe
            className={styles.player}
            src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${PARENT_DOMAIN}&muted=true`}
            allowFullScreen
            title="Twitch Stream"
          />
        </div>
        <div className={styles.chatWrapper}>
          <iframe
            className={styles.chat}
            src={`https://www.twitch.tv/embed/${TWITCH_CHANNEL}/chat?parent=${PARENT_DOMAIN}&darkpopout`}
            title="Twitch Chat"
          />
        </div>
      </motion.div>

      <EditableSection collection="livestream" dataKey="twitchChannel">
        <motion.div variants={fadeUp} className={styles.channelInfo}>
          <p className={styles.channelNote}>
            Channel: <code>{TWITCH_CHANNEL}</code>
          </p>
        </motion.div>
      </EditableSection>

      {/* Schedule */}
      <motion.section variants={fadeUp} className={styles.scheduleSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> STREAM SCHEDULE
        </h2>
        <EditableSection collection="livestream" dataKey="schedule">
          <div className={styles.scheduleGrid}>
            {SCHEDULE.map((slot, i) => (
              <div key={slot.day} className={styles.scheduleCard}>
                <h4 className={styles.scheduleDay}>
                  {slot.day.toUpperCase()}
                  <EditableItemControls index={i} />
                </h4>
                <p className={styles.scheduleTime}>{slot.time}</p>
                <p className={styles.scheduleGame}>{slot.game}</p>
              </div>
            ))}
          </div>
        </EditableSection>
      </motion.section>
    </motion.div>
  );
}
