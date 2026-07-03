CREATE TABLE `mixPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trackId` int NOT NULL,
	`presetName` varchar(255) NOT NULL,
	`stemLevels` json,
	`panValues` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mixPresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`stemType` enum('vocals','drums','bass','piano','guitar','other','master'),
	`fileUrl` varchar(1024),
	`fileSize` int DEFAULT 0,
	`duration` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`title` varchar(255),
	`artist` varchar(255),
	`fileSize` int NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`duration` int DEFAULT 0,
	`status` enum('uploaded','processing','completed','failed') DEFAULT 'uploaded',
	`isFavorite` boolean DEFAULT false,
	`fileUrl` varchar(1024),
	`separationJobId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracks_id` PRIMARY KEY(`id`)
);
