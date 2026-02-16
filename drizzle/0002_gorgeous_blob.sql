CREATE TABLE `baby_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`householdId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`type` varchar(32) NOT NULL,
	`eventTimestamp` varchar(64) NOT NULL,
	`data` text NOT NULL,
	`deleted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `baby_events_id` PRIMARY KEY(`id`)
);
