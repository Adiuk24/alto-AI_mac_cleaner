use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use chrono::Local;
use cron::Schedule;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub schedule: String, // Cron expression
    pub task_type: String,
    pub next_run: Option<i64>,
}

pub struct Scheduler {
    pub jobs: Arc<Mutex<Vec<Job>>>,
}

impl Scheduler {
    fn get_store_path() -> std::path::PathBuf {
        let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        path.push("alto");
        std::fs::create_dir_all(&path).ok();
        path.push("scheduler.json");
        path
    }

    fn load_jobs() -> Vec<Job> {
        let path = Self::get_store_path();
        if path.exists() {
            if let Ok(file) = std::fs::File::open(path) {
                if let Ok(jobs) = serde_json::from_reader(file) {
                    return jobs;
                }
            }
        }
        Vec::new()
    }

    fn save_jobs(jobs: &Vec<Job>) {
        let path = Self::get_store_path();
        if let Ok(file) = std::fs::File::create(path) {
            let _ = serde_json::to_writer(file, jobs);
        }
    }

    pub fn new() -> Self {
        let jobs: Arc<Mutex<Vec<Job>>> = Arc::new(Mutex::new(Self::load_jobs()));
        let jobs_clone = jobs.clone();

        // Start background thread to check jobs
        thread::spawn(move || {
            loop {
                thread::sleep(Duration::from_secs(60)); // Check every minute
                let mut jobs_lock = jobs_clone.lock().unwrap();
                let _now = Local::now();

                for job in jobs_lock.iter_mut() {
                    // Simple cron check logic would go here
                    // For now, we just print
                    println!("Checking job: {} - {}", job.id, job.task_type);
                    
                    if let Ok(schedule) = Schedule::from_str(&job.schedule) {
                       if let Some(next) = schedule.upcoming(Local).next() {
                           let _next_timestamp = next.timestamp();
                           // Logic to trigger task execution would go here
                           // involving emitting an event to frontend
                       }
                    }
                }
            }
        });

        Scheduler { jobs }
    }

    pub fn add_job(&self, schedule: String, task_type: String) -> String {
        let mut jobs = self.jobs.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        
        jobs.push(Job {
            id: id.clone(),
            schedule,
            task_type,
            next_run: None,
        });

        Self::save_jobs(&jobs);
        
        id
    }
}
